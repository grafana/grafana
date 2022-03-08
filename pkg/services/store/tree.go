package store

import (
	"context"
	"fmt"
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
	fmt.Println("preparing to list " + path)
	idx := strings.Index(path, "/")
	rootKey := path
	if idx > 0 {
		rootKey = path[:idx]
		path = path[idx+1:]
	}

	if rootKey == "" {
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

	root, ok := t.lookup[rootKey]
	if !ok || root == nil {
		return nil, nil // not found
	}

	listPath := path
	if listPath == "public" || listPath == "dev-dashboards" {
		// `public` does not exist in filestorage rooted at `/some/path/public` - we need to remove the storage prefix
		listPath = filestorage.Delimiter
	}
	if !strings.HasPrefix(listPath, filestorage.Delimiter) {
		// currently the API requires absolute paths
		listPath = filestorage.Delimiter + listPath
	}
	rsp, err := root.ListFiles(ctx, listPath, nil, nil)
	if err != nil {
		return nil, err
	}

	count := len(rsp.Files)
	names := data.NewFieldFromFieldType(data.FieldTypeString, count)
	mtype := data.NewFieldFromFieldType(data.FieldTypeString, count)
	fsize := data.NewFieldFromFieldType(data.FieldTypeInt64, count)
	names.Name = "name"
	mtype.Name = "mediaType"
	for i, f := range rsp.Files {
		names.Set(i, f.Name)
		mtype.Set(i, f.MimeType)
		fsize.Set(i, f.Size)
	}
	frame := data.NewFrame("", names, mtype, fsize)
	frame.SetMeta(&data.FrameMeta{
		Type: data.FrameTypeDirectoryListing,
		Custom: map[string]interface{}{
			"HasMore": rsp.HasMore,
		},
	})
	return frame, nil
}
