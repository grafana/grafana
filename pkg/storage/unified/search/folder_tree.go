package search

import (
	"context"
	"slices"
	"sync"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/query"
	index "github.com/blevesearch/bleve_index_api"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	foldermodel "github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// folderTree is the folder tree of a global index, held in memory so a search
// of a folder and everything below it is worked out when searching. Storing the
// folders above each document instead would need every document below a folder
// rewritten when the folder moves.
//
// It is read from the index's own folder documents the first time a search
// needs it, and kept up to date by every write after that. Reconcile repairs
// the folder documents, so the tree follows.
type folderTree struct {
	mu     sync.Mutex
	loaded bool
	// The folder each folder is in, "" for one at the top, and the reverse. For
	// top -> mid -> leaf, and other at the top:
	//
	//	parent:   {top: "", mid: top, leaf: mid, other: ""}
	//	children: {"": {top, other}, top: {mid}, mid: {leaf}}
	//
	// A folder with nothing below it has no children entry.
	parent   map[string]string
	children map[string]map[string]struct{}
}

// commit runs write, which commits items to the index, and records the folders
// they write or delete, as one step. Two writers then change the tree in the
// order they changed the index, and a write cannot land between loading the
// tree and keeping it up to date. Before the tree is loaded there is nothing to
// keep up to date: loading reads what was committed.
func (t *folderTree) commit(items []*resource.BulkIndexItem, write func() error) error {
	if !slices.ContainsFunc(items, writesFolder) {
		return write()
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	if err := write(); err != nil {
		return err
	}
	if !t.loaded {
		return nil
	}
	for _, item := range items {
		switch {
		case item.Action == resource.ActionIndex && item.Doc != nil && isFolderKey(item.Doc.Key):
			t.set(item.Doc.Key.Name, item.Doc.Folder)
		case item.Action == resource.ActionDelete && isFolderKey(item.Key):
			t.remove(item.Key.Name)
		}
	}
	return nil
}

func writesFolder(item *resource.BulkIndexItem) bool {
	if item.Action == resource.ActionDelete {
		return isFolderKey(item.Key)
	}
	return item.Doc != nil && isFolderKey(item.Doc.Key)
}

func (t *folderTree) set(name, parent string) {
	if foldermodel.IsRootFolderUID(parent) {
		parent = ""
	}
	t.remove(name)
	t.parent[name] = parent
	if t.children[parent] == nil {
		t.children[parent] = map[string]struct{}{}
	}
	t.children[parent][name] = struct{}{}
}

func (t *folderTree) remove(name string) {
	old, ok := t.parent[name]
	if !ok {
		return
	}
	delete(t.parent, name)
	delete(t.children[old], name)
	// Kept only while it has children, so memory follows the tree as it is now
	// rather than every folder it ever held.
	if len(t.children[old]) == 0 {
		delete(t.children, old)
	}
}

// below returns roots and every folder below them. A loop in the tree ends
// where it comes back to a folder already found.
func (t *folderTree) below(roots []string) []string {
	found := map[string]struct{}{}
	out := make([]string, 0, len(roots))
	pending := slices.Clone(roots)
	for len(pending) > 0 {
		f := pending[len(pending)-1]
		pending = pending[:len(pending)-1]
		if _, ok := found[f]; ok {
			continue
		}
		found[f] = struct{}{}
		out = append(out, f)
		for child := range t.children[f] {
			pending = append(pending, child)
		}
	}
	return out
}

// folderSubtree returns the named folders and every folder below them, loading
// the tree first if no search has needed it yet.
func (b *bleveIndex) folderSubtree(ctx context.Context, roots []string) ([]string, error) {
	b.folders.mu.Lock()
	defer b.folders.mu.Unlock()
	if !b.folders.loaded {
		if err := b.loadFolderTreeLocked(ctx); err != nil {
			return nil, err
		}
	}
	return b.folders.below(roots), nil
}

// loadFolderTreeLocked reads the folder each folder document is in, in one pass
// over the folder documents in index order. Paging through them sorted, as a
// search does, reads every folder again for each page.
func (b *bleveIndex) loadFolderTreeLocked(ctx context.Context) error {
	ctx, span := tracer.Start(ctx, "search.bleveIndex.loadFolderTree")
	defer span.End()
	start := time.Now()

	q, err := b.documentsOfQuery(schema.GroupResource{Group: folderv1.GROUP, Resource: folderv1.RESOURCE})
	if err != nil {
		return err
	}
	advanced, err := b.index.Advanced()
	if err != nil {
		return err
	}
	reader, err := advanced.Reader()
	if err != nil {
		return err
	}
	defer func() { _ = reader.Close() }()
	searcher, err := scopeQuery(q, false, 0).Searcher(ctx, reader, b.index.Mapping(), search.SearcherOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = searcher.Close() }()
	folders, err := reader.DocValueReader([]string{resource.SEARCH_FIELD_FOLDER})
	if err != nil {
		return err
	}

	// Built aside and kept only once fully read, so a failed load leaves nothing
	// half loaded.
	tree := folderTree{parent: map[string]string{}, children: map[string]map[string]struct{}{}}
	sctx := &search.SearchContext{DocumentMatchPool: search.NewDocumentMatchPool(searcher.DocumentMatchPoolSize(), 0)}
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		match, err := searcher.Next(sctx)
		if err != nil {
			return err
		}
		if match == nil {
			break
		}
		id, err := reader.ExternalID(match.IndexInternalID)
		if err != nil {
			return err
		}
		var key resourcepb.ResourceKey
		if err := resource.ReadSearchID(&key, id); err != nil {
			return err
		}
		// A folder at the top holds no folder value at all.
		folder := ""
		if err := folders.VisitDocValues(match.IndexInternalID, func(_ string, value []byte) {
			folder = string(value)
		}); err != nil {
			return err
		}
		tree.set(key.Name, folder)
		sctx.DocumentMatchPool.Put(match)
	}

	b.folders.parent, b.folders.children = tree.parent, tree.children
	b.folders.loaded = true
	b.logger.Info("Loaded the folder tree of the global search index", "folders", len(b.folders.parent), "duration", time.Since(start))
	return nil
}

// folderTreeQuery turns a folderTree filter into a filter on the folder each
// document is in: the named folders and every folder below them.
func (b *bleveIndex) folderTreeQuery(ctx context.Context, req *resourcepb.Requirement) (query.Query, *resourcepb.ErrorResult) {
	if !b.key.IsGlobal() {
		return nil, resource.NewBadRequestError(resource.SEARCH_FIELD_FOLDER_TREE + " can only be searched in the global search index")
	}
	switch selection.Operator(req.Operator) {
	case selection.In:
	case selection.Equals, selection.DoubleEquals:
		// Several values would mean every one of them, as on other fields, which a
		// document in one folder never matches; in is how to name several.
		if len(req.Values) != 1 {
			return nil, resource.NewBadRequestError(resource.SEARCH_FIELD_FOLDER_TREE + " takes one value with =, and several with in")
		}
	default:
		return nil, resource.NewBadRequestError(resource.SEARCH_FIELD_FOLDER_TREE + " only supports in and =")
	}
	// Everything is below the top.
	if slices.ContainsFunc(req.Values, foldermodel.IsRootFolderUID) {
		return nil, nil
	}
	folders, err := b.folderSubtree(ctx, req.Values)
	if err != nil {
		return nil, resource.AsErrorResult(err)
	}
	// The folders are worked out before the search runs, not in one snapshot
	// with it, so a folder moved in between can be searched in its old place.
	// That is as eventually consistent as the index itself is.
	if len(folders) <= folderTermFilterLimit {
		return b.requirementQuery(&resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_FOLDER,
			Operator: string(selection.In),
			Values:   folders,
		})
	}
	set := make(map[string]struct{}, len(folders))
	for _, f := range folders {
		set[f] = struct{}{}
	}
	return &folderSetQuery{folders: set}, nil
}

// folderTermFilterLimit is the most folders filtered on as one term each. A term
// per folder costs more the more folders there are, while checking each
// document's folder against the set costs more the more documents there are,
// however few folders it holds. So terms win for small sets and the check wins
// for large ones; BenchmarkGlobalFolderTree shows where they cross for a
// namespace the size of the largest ones. A variable so a test can take the
// other path without thousands of folders.
var folderTermFilterLimit = 20_000

// folderSetQuery matches the documents of query whose folder is in a set, read
// from the folder's doc values for each document query matches.
//
// It wraps the rest of the search rather than being one of its filters (see
// wrapInFolderSets): bleve treats an error from a filter as a document that
// does not match, so a failed read or a cancelled search would quietly return
// fewer results.
type folderSetQuery struct {
	folders map[string]struct{}
	// The rest of the search; every document when nil.
	query query.Query
	// Reads each document's folder; the index's doc values when nil. Set by
	// tests to make the read fail.
	readFolders func(index.IndexReader) (index.DocValueReader, error)
}

func (q *folderSetQuery) Searcher(ctx context.Context, i index.IndexReader, m mapping.IndexMapping, options search.SearcherOptions) (search.Searcher, error) {
	inner := q.query
	if inner == nil {
		inner = bleve.NewMatchAllQuery()
	}
	child, err := inner.Searcher(ctx, i, m, options)
	if err != nil {
		return nil, err
	}
	readFolders := q.readFolders
	if readFolders == nil {
		readFolders = func(i index.IndexReader) (index.DocValueReader, error) {
			return i.DocValueReader([]string{resource.SEARCH_FIELD_FOLDER})
		}
	}
	dv, err := readFolders(i)
	if err != nil {
		_ = child.Close()
		return nil, err
	}
	return newFolderSetSearcher(ctx, child, dv, q.folders), nil
}

// wrapInFolderSets takes the folder set checks out of filters and wraps them
// around the search that the other filters and the text query make, so their
// errors are returned rather than dropped.
func wrapInFolderSets(filters []query.Query, textQuery query.Query) query.Query {
	var sets []*folderSetQuery
	rest := slices.DeleteFunc(slices.Clone(filters), func(q query.Query) bool {
		set, ok := q.(*folderSetQuery)
		if ok {
			sets = append(sets, set)
		}
		return ok
	})
	q := combineFilterAndTextQueries(rest, textQuery)
	for _, set := range sets {
		q = &folderSetQuery{folders: set.folders, query: q, readFolders: set.readFolders}
	}
	return q
}

// folderSetSearcher passes on the documents of child whose folder is in a set.
// It reads every document child yields, so it checks for cancellation as it
// goes rather than only between the documents it passes on.
type folderSetSearcher struct {
	search.Searcher
	ctx     context.Context
	folders index.DocValueReader
	set     map[string]struct{}
}

func newFolderSetSearcher(ctx context.Context, child search.Searcher, folders index.DocValueReader, set map[string]struct{}) *folderSetSearcher {
	return &folderSetSearcher{Searcher: child, ctx: ctx, folders: folders, set: set}
}

// folderSetCheckEvery is how many documents are read between checks for
// cancellation.
const folderSetCheckEvery = 256

func (s *folderSetSearcher) Next(sctx *search.SearchContext) (*search.DocumentMatch, error) {
	return s.first(sctx, func() (*search.DocumentMatch, error) { return s.Searcher.Next(sctx) })
}

func (s *folderSetSearcher) Advance(sctx *search.SearchContext, id index.IndexInternalID) (*search.DocumentMatch, error) {
	advanced := false
	return s.first(sctx, func() (*search.DocumentMatch, error) {
		if advanced {
			return s.Searcher.Next(sctx)
		}
		advanced = true
		return s.Searcher.Advance(sctx, id)
	})
}

// first returns the first document from next whose folder is in the set.
func (s *folderSetSearcher) first(sctx *search.SearchContext, next func() (*search.DocumentMatch, error)) (*search.DocumentMatch, error) {
	for read := 1; ; read++ {
		if read%folderSetCheckEvery == 0 {
			if err := s.ctx.Err(); err != nil {
				return nil, err
			}
		}
		d, err := next()
		if err != nil || d == nil {
			return d, err
		}
		in := false
		if err := s.folders.VisitDocValues(d.IndexInternalID, func(_ string, value []byte) {
			_, in = s.set[string(value)]
		}); err != nil {
			return nil, err
		}
		if in {
			return d, nil
		}
		// Dropped, so returned to the pool rather than left to the collector.
		sctx.DocumentMatchPool.Put(d)
	}
}

func isFolderKey(key *resourcepb.ResourceKey) bool {
	return key.GetGroup() == folderv1.GROUP && key.GetResource() == folderv1.RESOURCE
}
