package store

import (
	"fmt"
	"testing"
)

func TestEmbeddedTree(t *testing.T) {
	store := newDiskStorage(RootStorageMeta{
		ReadOnly: true,
		Builtin:  true,
	}, RootStorageConfig{
		Prefix:      RootPublicStatic,
		Name:        "Public static files",
		Description: "Access files from the static public files",
		Disk: &StorageLocalDiskConfig{
			Path: "../../../public",
			Roots: []string{
				"/testdata/",
				"/img/",
				"/gazetteer/",
				"/maps/",
			},
		},
	})

	fmt.Printf("TODO... save static results: %v", store.Store())
}
