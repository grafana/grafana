package cleaner

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// RegistryServiceUnchecked is folder.RegistryService without the permission check, satisfied by
// *rules.RuleStore and *librarypanels.LibraryPanelService.
type RegistryServiceUnchecked interface {
	DeleteInFoldersUnchecked(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) error
}

// NewUncheckedContentsCleaner wires the Unchecked delete method instead of the checked one, for a
// standalone apiserver whose caller (cascadeDeleteStorage) has already marked ctx authorized via
// folder.WithUncheckedDeleteAuthorized, once its own authlib.AccessClient check has passed.
func NewUncheckedContentsCleaner(services ...RegistryServiceUnchecked) *ContentsCleaner {
	deleteFuncs := make([]DeleteFunc, len(services))
	for i, s := range services {
		deleteFuncs[i] = s.DeleteInFoldersUnchecked
	}
	return &ContentsCleaner{deleteFuncs: deleteFuncs}
}
