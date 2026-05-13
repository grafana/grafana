package prometheusrulegroup

import (
	"context"
	"time"

	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

// NamespaceResolver is the narrow slice of the ngalert rule store we need to
// auto-create a default folder when the caller doesn't supply one.
type NamespaceResolver interface {
	GetOrCreateNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, bool, error)
}

func NewStorage(
	ruleSvc provisioning.AlertRuleService,
	resolver NamespaceResolver,
	namespacer request.NamespaceMapper,
	defaultInterval time.Duration,
) grafanarest.Storage {
	return &legacyStorage{
		service:         ruleSvc,
		resolver:        resolver,
		namespacer:      namespacer,
		defaultInterval: defaultInterval,
		tableConverter:  rest.NewDefaultTableConvertor(ResourceInfo.GroupResource()),
	}
}
