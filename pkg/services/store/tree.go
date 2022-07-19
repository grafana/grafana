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
	lookup       map[int64]map[string]storageRuntime

	orgInitMutex          sync.Mutex
	initializeOrgStorages func(orgId int64) []storageRuntime
}

var (
	_ storageTree = (*nestedTree)(nil)
)

func asNameToFileStorageMap(storages []storageRuntime) map[string]storageRuntime {
	lookup := make(map[string]storageRuntime)
	for _, storage := range storages {
		lookup[storage.Meta().Config.Prefix] = storage
	}
	return lookup
}

func (t *nestedTree) init() {
	t.orgInitMutex.Lock()
	defer t.orgInitMutex.Unlock()

	t.lookup = make(map[int64]map[string]storageRuntime, len(t.rootsByOrgId))

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

func (t *nestedTree) getRoot(orgId int64, path string) (storageRuntime, string) {
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
	return root.Store().Get(ctx, path)
}

func (t *nestedTree) ListFolder(ctx context.Context, orgId int64, path string, accessFilter filestorage.PathFilter) (*StorageListFrame, error) {
	if path == "" || path == "/" {
		t.assureOrgIsInitialized(orgId)

		idx := 0
		count := len(t.rootsByOrgId[ac.GlobalOrgID])
		if orgId != ac.GlobalOrgID {
			count += len(t.rootsByOrgId[orgId])
		}

		names := data.NewFieldFromFieldType(data.FieldTypeString, count)
		title := data.NewFieldFromFieldType(data.FieldTypeString, count)
		descr := data.NewFieldFromFieldType(data.FieldTypeString, count)
		types := data.NewFieldFromFieldType(data.FieldTypeString, count)
		readOnly := data.NewFieldFromFieldType(data.FieldTypeBool, count)
		builtIn := data.NewFieldFromFieldType(data.FieldTypeBool, count)
		mtype := data.NewFieldFromFieldType(data.FieldTypeString, count)
		title.Name = titleListFrameField
		names.Name = nameListFrameField
		descr.Name = descriptionListFrameField
		mtype.Name = mediaTypeListFrameField
		types.Name = storageTypeListFrameField
		readOnly.Name = readOnlyListFrameField
		builtIn.Name = builtInListFrameField
		for _, f := range t.rootsByOrgId[ac.GlobalOrgID] {
			meta := f.Meta()
			names.Set(idx, meta.Config.Prefix)
			title.Set(idx, meta.Config.Name)
			descr.Set(idx, meta.Config.Description)
			mtype.Set(idx, "directory")
			types.Set(idx, meta.Config.Type)
			readOnly.Set(idx, meta.ReadOnly)
			builtIn.Set(idx, meta.Builtin)
			idx++
		}
		if orgId != ac.GlobalOrgID {
			for _, f := range t.rootsByOrgId[orgId] {
				meta := f.Meta()
				names.Set(idx, meta.Config.Prefix)
				title.Set(idx, meta.Config.Name)
				descr.Set(idx, meta.Config.Description)
				mtype.Set(idx, "directory")
				types.Set(idx, meta.Config.Type)
				readOnly.Set(idx, meta.ReadOnly)
				builtIn.Set(idx, meta.Builtin)
				idx++
			}
		}

		frame := data.NewFrame("", names, title, descr, mtype, types, readOnly, builtIn)
		frame.SetMeta(&data.FrameMeta{
			Type: data.FrameTypeDirectoryListing,
		})
		return &StorageListFrame{frame}, nil
	}

	root, path := t.getRoot(orgId, path)
	if root == nil {
		return nil, nil // not found (or not ready)
	}

	listResponse, err := root.Store().List(ctx, path, nil, &filestorage.ListOptions{
		Recursive:   false,
		WithFolders: true,
		WithFiles:   true,
		Filter:      accessFilter,
	})

	if err != nil {
		return nil, err
	}

	count := len(listResponse.Files)
	names := data.NewFieldFromFieldType(data.FieldTypeString, count)
	mtype := data.NewFieldFromFieldType(data.FieldTypeString, count)
	fsize := data.NewFieldFromFieldType(data.FieldTypeInt64, count)
	names.Name = nameListFrameField
	mtype.Name = mediaTypeListFrameField
	fsize.Name = sizeListFrameField
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
	return &StorageListFrame{frame}, nil
}
