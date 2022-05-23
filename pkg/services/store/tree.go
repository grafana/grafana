package store

import (
	"context"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

type nestedTree struct {
	rootsByOrgId map[int64][]storageRuntime
	lookup       map[int64]map[string]filestorage.FileStorage

	orgInitMutex          sync.Mutex
	initializeOrgStorages func(orgId int64) []storageRuntime
}

var (
	_ storageTree = (*nestedTree)(nil)
)

func asNameToFileStorageMap(storages []storageRuntime) map[string]filestorage.FileStorage {
	lookup := make(map[string]filestorage.FileStorage)
	for _, storage := range storages {
		lookup[storage.Meta().Config.Prefix] = storage.Store()
	}
	return lookup
}

func (t *nestedTree) init() {
	t.orgInitMutex.Lock()
	defer t.orgInitMutex.Unlock()

	t.lookup = make(map[int64]map[string]filestorage.FileStorage, len(t.rootsByOrgId))

	for orgId, storages := range t.rootsByOrgId {
		t.lookup[orgId] = asNameToFileStorageMap(storages)
	}
}

func (t *nestedTree) assureOrgIsInitialized(orgId int64) {
	t.orgInitMutex.Lock()
	defer t.orgInitMutex.Unlock()
	if _, ok := t.rootsByOrgId[orgId]; !ok {
		orgStorages := t.initializeOrgStorages(orgId)
		t.rootsByOrgId[orgId] = orgStorages
		t.lookup[orgId] = asNameToFileStorageMap(orgStorages)
	}
}

func (t *nestedTree) getRoot(orgId int64, path string) (filestorage.FileStorage, string) {
	t.assureOrgIsInitialized(orgId)

	if path == "" {
		return nil, ""
	}

	rootKey, path := splitFirstSegment(path)
	root, ok := t.lookup[orgId][rootKey]
	if ok && root != nil {
		return root, filestorage.Delimiter + path
	}

	if orgId != ac.GlobalOrgID {
		globalRoot, ok := t.lookup[ac.GlobalOrgID][rootKey]
		if ok && globalRoot != nil {
			return globalRoot, filestorage.Delimiter + path
		}
	}

	return nil, path // not found or not ready
}

func (t *nestedTree) GetFile(ctx context.Context, orgId int64, path string) (*filestorage.File, error) {
	if path == "" {
		return nil, nil // not found
	}

	root, path := t.getRoot(orgId, path)
	if root == nil {
		return nil, nil // not found (or not ready)
	}
	return root.Get(ctx, path)
}

func (t *nestedTree) ListFolder(ctx context.Context, orgId int64, path string) (*data.Frame, error) {
	if path == "" || path == "/" {
		t.assureOrgIsInitialized(orgId)

		count := len(t.rootsByOrgId[ac.GlobalOrgID])
		if orgId != ac.GlobalOrgID {
			count += len(t.rootsByOrgId[orgId])
		}

		title := data.NewFieldFromFieldType(data.FieldTypeString, count)
		names := data.NewFieldFromFieldType(data.FieldTypeString, count)
		mtype := data.NewFieldFromFieldType(data.FieldTypeString, count)
		title.Name = "title"
		names.Name = "name"
		mtype.Name = "mediaType"
		for i, f := range t.rootsByOrgId[ac.GlobalOrgID] {
			names.Set(i, f.Meta().Config.Prefix)
			title.Set(i, f.Meta().Config.Name)
			mtype.Set(i, "directory")
		}
		if orgId != ac.GlobalOrgID {
			for i, f := range t.rootsByOrgId[orgId] {
				names.Set(i, f.Meta().Config.Prefix)
				title.Set(i, f.Meta().Config.Name)
				mtype.Set(i, "directory")
			}
		}

		frame := data.NewFrame("", names, title, mtype)
		frame.SetMeta(&data.FrameMeta{
			Type: data.FrameTypeDirectoryListing,
		})
		return frame, nil
	}

	root, path := t.getRoot(orgId, path)
	if root == nil {
		return nil, nil // not found (or not ready)
	}

	listResponse, err := root.List(ctx, path, nil, &filestorage.ListOptions{Recursive: false, WithFolders: true, WithFiles: true})

	if err != nil {
		return nil, err
	}

	count := len(listResponse.Files)
	names := data.NewFieldFromFieldType(data.FieldTypeString, count)
	mtype := data.NewFieldFromFieldType(data.FieldTypeString, count)
	fsize := data.NewFieldFromFieldType(data.FieldTypeInt64, count)
	names.Name = "name"
	mtype.Name = "mediaType"
	fsize.Name = "size"
	fsize.Config = &data.FieldConfig{
		Unit: "bytes",
	}
	for i, f := range listResponse.Files {
		names.Set(i, f.Name)
		mtype.Set(i, f.MimeType)
		fsize.Set(i, f.Size)
	}
	frame := data.NewFrame("", names, mtype, fsize)
	frame.SetMeta(&data.FrameMeta{
		Type: data.FrameTypeDirectoryListing,
		Custom: map[string]interface{}{
			"HasMore": listResponse.HasMore,
		},
	})
	return frame, nil
}
