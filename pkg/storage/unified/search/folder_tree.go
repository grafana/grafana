package search

import (
	"context"
	"fmt"
	"slices"
	"sync"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/query"
	index "github.com/blevesearch/bleve_index_api"
	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	foldermodel "github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// folderTree is the hierarchy of a global or folder index, held in memory so a search
// of a folder and everything below it is worked out when searching. Storing the
// folders above each document instead would need every document below a folder
// rewritten when the folder moves.
//
// It is read from the index's own folder documents the first time a search
// needs it, and kept up to date by every write after that.
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
			if item.Doc.IsDeleted != nil && *item.Doc.IsDeleted {
				t.remove(item.Doc.Key.Name)
			} else {
				t.set(item.Doc.Key.Name, item.Doc.Folder)
			}
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

// folderSubtree returns the named folders and every folder below them.
func (b *bleveIndex) folderSubtree(ctx context.Context, roots []string) ([]string, error) {
	var folders []string
	err := b.readFolderTree(ctx, func(t *folderTree) { folders = t.below(roots) })
	return folders, err
}

// readFolderTree calls read with the folder tree, loading it first if no search
// has needed it yet.
func (b *bleveIndex) readFolderTree(ctx context.Context, read func(*folderTree)) error {
	// The helper index can close independently of the index being searched.
	b.updaterMu.Lock()
	closed := b.updaterShutdown
	b.updaterMu.Unlock()
	if closed {
		return fmt.Errorf("cannot read folder tree: %w", bleve.ErrorIndexClosed)
	}
	b.folders.mu.Lock()
	defer b.folders.mu.Unlock()
	if !b.folders.loaded {
		if err := b.loadFolderTreeLocked(ctx); err != nil {
			return err
		}
	}
	read(&b.folders)
	return nil
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
	// Built aside and kept only once fully read, so a failed load leaves nothing
	// half loaded.
	tree := folderTree{parent: map[string]string{}, children: map[string]map[string]struct{}{}}
	err = b.visitLiveDocuments(ctx, q, []string{resource.SEARCH_FIELD_FOLDER}, func(_ index.IndexReader, id string, internal index.IndexInternalID, docValues index.DocValueReader) error {
		var key resourcepb.ResourceKey
		if err := resource.ReadSearchID(&key, id); err != nil {
			return err
		}
		// A folder at the top holds no folder value at all.
		folder := ""
		if err := docValues.VisitDocValues(internal, func(_ string, value []byte) {
			folder = string(value)
		}); err != nil {
			return err
		}
		tree.set(key.Name, folder)
		return nil
	})
	if err != nil {
		return err
	}

	b.folders.parent, b.folders.children = tree.parent, tree.children
	b.folders.loaded = true
	b.logger.Info("Loaded the folder tree of the search index", "folders", len(b.folders.parent), "duration", time.Since(start))
	return nil
}

// folderTreeQuery turns a folderTree filter into a filter on the folder each
// document is in: the named folders and every folder below them.
func (b *bleveIndex) folderTreeQuery(ctx context.Context, req *resourcepb.Requirement, folderIndex *bleveIndex) (query.Query, *resourcepb.ErrorResult) {
	if err := resource.ValidateFolderTreeRequirement(req); err != nil {
		return nil, err
	}
	if len(req.Values) == 0 {
		return bleve.NewMatchNoneQuery(), nil
	}
	// Everything is below the top.
	if slices.ContainsFunc(req.Values, foldermodel.IsRootFolderUID) {
		return nil, nil
	}
	if folderIndex == nil {
		return nil, resource.NewBadRequestError(resource.SEARCH_FIELD_FOLDER_TREE + " requires a folder index")
	}
	folders, err := folderIndex.folderSubtree(ctx, req.Values)
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

// addFolderPaths gives a global search response the path of each folder its
// rows are in. Paths are display data, so a failure leaves them out rather
// than failing the search.
func (b *bleveIndex) addFolderPaths(ctx context.Context, access authlib.AccessClient, response *resourcepb.ResourceSearchResponse) {
	names := responseFolders(response)
	if len(names) == 0 {
		return
	}
	paths, err := b.folderPaths(ctx, access, names)
	if err != nil {
		b.logger.FromContext(ctx).Warn("Failed to find the folder paths of global search results", "error", err)
		return
	}
	response.FolderPaths = paths
}

// responseFolders returns the folders the rows are in, other than the root.
func responseFolders(response *resourcepb.ResourceSearchResponse) []string {
	column := slices.IndexFunc(response.Fields, func(f *resourcepb.ResourceSearchField) bool {
		return f.Name == resource.SEARCH_FIELD_FOLDER
	})
	if column < 0 {
		return nil
	}
	var names []string
	for _, row := range response.Rows {
		for _, v := range row.Values {
			if int(v.FieldIndex) != column || len(v.StringValues) == 0 {
				continue
			}
			if name := v.StringValues[0]; !foldermodel.IsRootFolderUID(name) && !slices.Contains(names, name) {
				names = append(names, name)
			}
		}
	}
	return names
}

// folderPaths follows the folder API's parents logic: walk upward from each
// named folder, stopping at the first unreadable or missing folder, which is
// included by name only with detached=true. Reverse each path for the response
// so ancestors come first and the named folder comes last.
func (b *bleveIndex) folderPaths(ctx context.Context, access authlib.AccessClient, names []string) (map[string]*resourcepb.FolderPath, error) {
	ctx, span := tracer.Start(ctx, "search.bleveIndex.folderPaths")
	defer span.End()

	chains, parents, err := b.folderChains(ctx, names)
	if err != nil {
		return nil, err
	}
	titles, err := b.folderTitles(ctx, parents)
	if err != nil {
		return nil, err
	}
	readable, err := b.readableFolders(ctx, access, parents, titles)
	if err != nil {
		return nil, err
	}

	paths := make(map[string]*resourcepb.FolderPath, len(names))
	for name, chain := range chains {
		path := &resourcepb.FolderPath{}
		for _, f := range chain {
			if !readable[f] {
				path.Folders = append(path.Folders, &resourcepb.FolderPath_Folder{Name: f, Detached: true})
				break
			}
			path.Folders = append(path.Folders, &resourcepb.FolderPath_Folder{Name: f, Title: titles[f]})
		}
		slices.Reverse(path.Folders)
		paths[name] = path
	}
	return paths, nil
}

// folderChains returns each named folder and the folders above it, from the
// bottom up, and the folder each of them is in. A chain ends below the root, at
// a folder the tree does not hold, or where it comes back to a folder it holds.
func (b *bleveIndex) folderChains(ctx context.Context, names []string) (map[string][]string, map[string]string, error) {
	chains := make(map[string][]string, len(names))
	parents := map[string]string{}
	err := b.readFolderTree(ctx, func(t *folderTree) {
		for _, name := range names {
			var chain []string
			for f := name; f != "" && !slices.Contains(chain, f); {
				chain = append(chain, f)
				parent, ok := t.parent[f]
				if !ok {
					break
				}
				parents[f] = parent
				f = parent
			}
			chains[name] = chain
		}
	})
	return chains, parents, err
}

// folderTitles returns the title of each folder the index holds.
func (b *bleveIndex) folderTitles(ctx context.Context, folders map[string]string) (map[string]string, error) {
	if len(folders) == 0 {
		return nil, nil
	}
	ids := make([]string, 0, len(folders))
	for name := range folders {
		ids = append(ids, resource.SearchID(&resourcepb.ResourceKey{
			Namespace: b.key.Namespace, Group: folderGroup, Resource: folderResource, Name: name,
		}))
	}
	res, err := searchInContext(ctx, b.index, &bleve.SearchRequest{
		Query:  bleve.NewDocIDQuery(ids),
		Size:   len(ids),
		Fields: []string{resource.SEARCH_FIELD_TITLE},
		Score:  bleve.ScoreNone,
	})
	if err != nil {
		return nil, err
	}
	titles := make(map[string]string, len(res.Hits))
	for _, hit := range res.Hits {
		var key resourcepb.ResourceKey
		if err := resource.ReadSearchID(&key, hit.ID); err != nil {
			return nil, err
		}
		title, _ := hit.Fields[resource.SEARCH_FIELD_TITLE].(string)
		titles[key.Name] = title
	}
	return titles, nil
}

// readableFolders returns which of the folders found in the index the caller
// may read. Without an access client nothing is checked, as in the search.
func (b *bleveIndex) readableFolders(ctx context.Context, access authlib.AccessClient, parents, titles map[string]string) (map[string]bool, error) {
	found := make([]string, 0, len(titles))
	for name := range titles {
		found = append(found, name)
	}
	readable := make(map[string]bool, len(found))
	if access == nil {
		for _, name := range found {
			readable[name] = true
		}
		return readable, nil
	}
	items := func(yield func(string) bool) {
		for _, name := range found {
			if !yield(name) {
				return
			}
		}
	}
	check := func(name string) authz.BatchCheckItem {
		return authz.BatchCheckItem{
			Name:      name,
			Folder:    parents[name],
			Verb:      utils.VerbGet,
			Group:     folderGroup,
			Resource:  folderResource,
			Namespace: b.key.Namespace,
		}
	}
	for name, err := range authz.FilterAuthorized(ctx, access, items, check, authz.WithTracer(tracer), authz.WithSizeHint(len(found))) {
		if err != nil {
			return nil, err
		}
		readable[name] = true
	}
	return readable, nil
}
