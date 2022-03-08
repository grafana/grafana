package store

import (
	"context"
	"strings"

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

func (t *nestedTree) GetFile(ctx context.Context, path string) (*filestorage.File, error) {
	if path == "" {
		return nil, nil // not found
	}
	idx := strings.Index(path, "/")
	if idx > 0 {
		root, ok := t.lookup[path[:idx]]
		if !ok || root == nil {
			return nil, nil // not found
		}
		return root.Get(ctx, path[idx+1:])
	}
	return nil, nil
}

func (t *nestedTree) ListFolder(ctx context.Context, path string) (*data.Frame, error) {
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

	rootKey, path := splitFirstSegment(path)

	root, ok := t.lookup[rootKey]
	if !ok || root == nil {
		return nil, nil // not found or not ready
	}

	listPath := filestorage.Delimiter + path
	files, err := root.ListFiles(ctx, listPath, nil, nil)
	if err != nil {
		return nil, err
	}

	folders, err := root.ListFolders(ctx, listPath, &filestorage.ListOptions{Recursive: false})
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
