package store

import (
	"context"
	"fmt"
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
		isUnderContentRoot := storage.Meta().Config.UnderContentRoot
		prefix := storage.Meta().Config.Prefix
		if !isUnderContentRoot {
			lookup[prefix] = storage
		} else {
			lookup[fmt.Sprintf("%s/%s", RootContent, prefix)] = storage
		}
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
		if root.Meta().Config.Prefix == RootContent && path != "" && path != "/" {
			mountedKey, nestedPath := splitFirstSegment(path)
			nestedLookupKey := rootKey + filestorage.Delimiter + mountedKey
			nestedRoot, nestedOk := t.lookup[orgId][nestedLookupKey]

			if nestedOk && nestedRoot != nil {
				return nestedRoot, filestorage.Delimiter + nestedPath
			}

			if orgId != ac.GlobalOrgID {
				globalRoot, globalOk := t.lookup[ac.GlobalOrgID][nestedLookupKey]
				if globalOk && globalRoot != nil {
					return globalRoot, filestorage.Delimiter + nestedPath
				}
			}
		}

		return root, filestorage.Delimiter + path
	}

	if orgId != ac.GlobalOrgID {
		globalRoot, ok := t.lookup[ac.GlobalOrgID][rootKey]
		if ok && globalRoot != nil {
			if globalRoot.Meta().Config.Prefix == RootContent && path != "" && path != "/" {
				mountedKey, nestedPath := splitFirstSegment(path)
				nestedLookupKey := rootKey + filestorage.Delimiter + mountedKey
				nestedRoot, nestedOk := t.lookup[orgId][nestedLookupKey]

				if nestedOk && nestedRoot != nil {
					return nestedRoot, filestorage.Delimiter + nestedPath
				}

				globalNestedRoot, globalOk := t.lookup[ac.GlobalOrgID][nestedLookupKey]
				if globalOk && globalNestedRoot != nil {
					return globalNestedRoot, filestorage.Delimiter + nestedPath
				}
			}

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
	store := root.Store()
	if store == nil {
		return nil, fmt.Errorf("store not ready")
	}
	file, _, err := store.Get(ctx, path, nil)
	return file, err
}

func filterStoragesUnderContentRoot(storages []storageRuntime) []storageRuntime {
	out := make([]storageRuntime, 0)
	for _, s := range storages {
		if s.Meta().Config.UnderContentRoot {
			out = append(out, s)
		}
	}
	return out
}

func (t *nestedTree) getStorages(orgId int64) []storageRuntime {
	globalStorages := make([]storageRuntime, 0)
	globalStorages = append(globalStorages, t.rootsByOrgId[ac.GlobalOrgID]...)

	if orgId == ac.GlobalOrgID {
		return append(make([]storageRuntime, 0), globalStorages...)
	}

	orgPrefixes := make(map[string]bool)
	storages := make([]storageRuntime, 0)

	for _, s := range t.rootsByOrgId[orgId] {
		storages = append(storages, s)
		orgPrefixes[s.Meta().Config.Prefix] = true
	}

	for _, s := range globalStorages {
		// prefer org-specific storage over global with the same prefix
		if ok := orgPrefixes[s.Meta().Config.Prefix]; !ok {
			storages = append(storages, s)
		}
	}

	return storages
}

func (t *nestedTree) ListFolder(ctx context.Context, orgId int64, path string, accessFilter filestorage.PathFilter) (*StorageListFrame, error) {
	if path == "" || path == "/" {
		t.assureOrgIsInitialized(orgId)

		idx := 0

		storages := t.getStorages(orgId)
		count := len(storages)
		grafanaStorageLogger.Info("Listing root folder", "path", path, "storageCount", len(storages))

		names := data.NewFieldFromFieldType(data.FieldTypeString, count)
		title := data.NewFieldFromFieldType(data.FieldTypeString, count)
		descr := data.NewFieldFromFieldType(data.FieldTypeString, count)
		mtype := data.NewFieldFromFieldType(data.FieldTypeString, count)
		title.Name = titleListFrameField
		names.Name = nameListFrameField
		descr.Name = descriptionListFrameField
		mtype.Name = mediaTypeListFrameField
		for _, f := range storages {
			meta := f.Meta()
			names.Set(idx, meta.Config.Prefix)
			title.Set(idx, meta.Config.Name)
			descr.Set(idx, meta.Config.Description)
			mtype.Set(idx, "directory")
			idx++
		}

		frame := data.NewFrame("", names, title, descr, mtype)
		frame.SetMeta(&data.FrameMeta{
			Type: data.FrameTypeDirectoryListing,
		})
		return &StorageListFrame{frame}, nil
	}

	root, path := t.getRoot(orgId, path)
	if root == nil {
		return nil, nil // not found (or not ready)
	}

	var storages []storageRuntime
	if root.Meta().Config.Prefix == RootContent && (path == "" || path == "/") {
		storages = filterStoragesUnderContentRoot(t.getStorages(orgId))
	}
	grafanaStorageLogger.Info("Listing folder", "path", path, "storageCount", len(storages), "root", root.Meta().Config.Prefix)

	store := root.Store()
	if store == nil {
		return nil, fmt.Errorf("store not ready")
	}

	pathFilter := accessFilter
	if root.Meta().Config.Prefix == RootContent && len(storages) > 0 {
		// create a PathFilter that will filter out folders that are "shadowed" by the mounted storages
		pathFilter = filestorage.NewAndPathFilter(
			accessFilter,
			t.createPathFilterForContentRoot(storages),
		)
	}

	listResponse, err := store.List(ctx, path, nil, &filestorage.ListOptions{
		Recursive:   false,
		WithFolders: true,
		WithFiles:   true,
		Filter:      pathFilter,
	})

	if err != nil {
		return nil, err
	}

	count := len(listResponse.Files) + len(storages)
	names := data.NewFieldFromFieldType(data.FieldTypeString, count)
	mtype := data.NewFieldFromFieldType(data.FieldTypeString, count)
	fsize := data.NewFieldFromFieldType(data.FieldTypeInt64, count)
	names.Name = nameListFrameField
	mtype.Name = mediaTypeListFrameField
	fsize.Name = sizeListFrameField
	fsize.Config = &data.FieldConfig{
		Unit: "bytes",
	}

	idx := 0
	for _, s := range storages {
		names.Set(idx, s.Meta().Config.Prefix)
		mtype.Set(idx, filestorage.DirectoryMimeType)
		fsize.Set(idx, int64(0))
		idx++
	}

	for _, f := range listResponse.Files {
		names.Set(idx, f.Name)
		mtype.Set(idx, f.MimeType)
		fsize.Set(idx, f.Size)
		idx++
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

func (t *nestedTree) createPathFilterForContentRoot(storages []storageRuntime) filestorage.PathFilter {
	disallowedPrefixes := make([]string, 0)
	disallowedPaths := make([]string, 0)

	for _, s := range storages {
		path := filestorage.Delimiter + s.Meta().Config.Prefix
		disallowedPaths = append(disallowedPaths, path)
		disallowedPrefixes = append(disallowedPrefixes, path+filestorage.Delimiter)
	}

	grafanaStorageLogger.Info("Created a path filter for the content root", "disallowedPrefixes", disallowedPrefixes, "disallowedPaths", disallowedPaths)
	return filestorage.NewPathFilter(nil, nil, disallowedPrefixes, disallowedPaths)
}
