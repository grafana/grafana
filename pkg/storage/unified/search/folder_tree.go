package search

import (
	"context"
	"slices"
	"sync"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/search/query"
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

// loadFolderTreeLocked reads the folder each folder document is in, a page at a
// time, as ListDocumentRefs does.
func (b *bleveIndex) loadFolderTreeLocked(ctx context.Context) error {
	ctx, span := tracer.Start(ctx, "search.bleveIndex.loadFolderTree")
	defer span.End()
	start := time.Now()

	q, err := b.documentsOfQuery(schema.GroupResource{Group: folderv1.GROUP, Resource: folderv1.RESOURCE})
	if err != nil {
		return err
	}
	b.folders.parent = map[string]string{}
	b.folders.children = map[string]map[string]struct{}{}
	var searchAfter []string
	for {
		req := &bleve.SearchRequest{
			Size:        listDocumentRefsPageSize,
			Query:       scopeQuery(q, false, 0),
			Fields:      []string{resource.SEARCH_FIELD_FOLDER},
			SearchAfter: searchAfter,
		}
		req.SortBy([]string{"_id"})
		rsp, err := b.index.SearchInContext(ctx, req)
		if err != nil {
			return err
		}
		for _, hit := range rsp.Hits {
			var key resourcepb.ResourceKey
			if err := resource.ReadSearchID(&key, hit.ID); err != nil {
				return err
			}
			// A folder at the top holds no folder value at all.
			parent, _ := hit.Fields[resource.SEARCH_FIELD_FOLDER].(string)
			b.folders.set(key.Name, parent)
		}
		if len(rsp.Hits) < listDocumentRefsPageSize {
			break
		}
		searchAfter = rsp.Hits[len(rsp.Hits)-1].Sort
	}
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
	return b.requirementQuery(&resourcepb.Requirement{
		Key:      resource.SEARCH_FIELD_FOLDER,
		Operator: string(selection.In),
		Values:   folders,
	})
}

func isFolderKey(key *resourcepb.ResourceKey) bool {
	return key.GetGroup() == folderv1.GROUP && key.GetResource() == folderv1.RESOURCE
}
