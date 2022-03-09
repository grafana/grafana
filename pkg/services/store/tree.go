package store

import (
	"context"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/filestorage"
)

type nestedTree struct {
	roots  []storageRuntime
	lookup map[string]filestorage.FileStorage
}

var (
	_ storageTree = (*nestedTree)(nil)
)

func (t *nestedTree) init() {
	t.lookup = make(map[string]filestorage.FileStorage, len(t.roots))
	for _, root := range t.roots {
		t.lookup[root.Meta().Config.Prefix] = root.Store()
	}
}

func (t *nestedTree) getRootPrefix(path string) string {
	if path == "" {
		return ""
	}

	rootKey, _ := splitFirstSegment(path)
	return filestorage.Join(rootKey)
}

func (t *nestedTree) getRoot(path string) (filestorage.FileStorage, string) {
	if path == "" {
		return nil, ""
	}

	rootKey, path := splitFirstSegment(path)
	root, ok := t.lookup[rootKey]
	if !ok || root == nil {
		return nil, path // not found or not ready
	}
	return root, filestorage.Delimiter + path
}

func (t *nestedTree) GetFile(ctx context.Context, path string) (*filestorage.File, error) {
	if path == "" {
		return nil, nil // not found
	}

	root, path := t.getRoot(path)
	if root == nil {
		return nil, nil // not found (or not ready)
	}
	return root.Get(ctx, path)
}

func (t *nestedTree) ListFolder(ctx context.Context, path string, filters *filestorage.PathFilters) (*data.Frame, error) {
	if path == "" || path == "/" {
		count := len(t.roots)
		names := data.NewFieldFromFieldType(data.FieldTypeString, count)
		mtype := data.NewFieldFromFieldType(data.FieldTypeString, count)
		names.Name = "name"
		mtype.Name = "mediaType"
		for i, f := range t.roots {
			names.Set(i, f.Meta().Config.Prefix)
			mtype.Set(i, "directory")
		}
		frame := data.NewFrame("", names, mtype)
		frame.SetMeta(&data.FrameMeta{
			Type: data.FrameTypeDirectoryListing,
		})
		return frame, nil
	}

	root, path := t.getRoot(path)
	if root == nil {
		return nil, nil // not found (or not ready)
	}

	files, err := root.ListFiles(ctx, path, nil, &filestorage.ListOptions{Recursive: false, PathFilters: filters})
	if err != nil {
		return nil, err
	}

	folders, err := root.ListFolders(ctx, path, &filestorage.ListOptions{Recursive: false, PathFilters: filters})
	if err != nil {
		return nil, err
	}
	for i := range folders {
		folders[i].MimeType = "directory" // hack for now
	}

	count := len(files.Files) + len(folders)
	names := data.NewFieldFromFieldType(data.FieldTypeString, count)
	mtype := data.NewFieldFromFieldType(data.FieldTypeString, count)
	fsize := data.NewFieldFromFieldType(data.FieldTypeInt64, count)
	names.Name = "name"
	mtype.Name = "mediaType"
	fsize.Name = "size"
	fsize.Config = &data.FieldConfig{
		Unit: "bytes",
	}
	for i, f := range append(folders, files.Files...) {
		names.Set(i, f.Name)
		mtype.Set(i, f.MimeType)
		fsize.Set(i, f.Size)
	}
	frame := data.NewFrame("", names, mtype, fsize)
	frame.SetMeta(&data.FrameMeta{
		Type: data.FrameTypeDirectoryListing,
		Custom: map[string]interface{}{
			"HasMore": files.HasMore,
		},
	})
	return frame, nil
}
