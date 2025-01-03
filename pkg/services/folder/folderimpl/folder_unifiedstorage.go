package folderimpl

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8sUser "k8s.io/apiserver/pkg/authentication/user"
	k8sRequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
)

// interface to allow for testing
type folderK8sHandler interface {
	getClient(ctx context.Context, orgID int64) (dynamic.ResourceInterface, bool)
	getNamespace(orgID int64) string
}

var _ folderK8sHandler = (*foldk8sHandler)(nil)

type foldk8sHandler struct {
	cfg        *setting.Cfg
	namespacer request.NamespaceMapper
	gvr        schema.GroupVersionResource
}

func toFolderLegacyCounts(u *unstructured.Unstructured) (*folder.DescendantCounts, error) {
	ds, err := v0alpha1.UnstructuredToDescendantCounts(u)
	if err != nil {
		return nil, err
	}

	var out = make(folder.DescendantCounts)
	for _, v := range ds.Counts {
		// if stats come from unified storage, we will use them
		if v.Group != "sql-fallback" {
			out[v.Resource] = v.Count
			continue
		}
		// if stats are from single tenant DB and they are not in unified storage, we will use them
		if _, ok := out[v.Resource]; !ok {
			out[v.Resource] = v.Count
		}
	}
	return &out, nil
}

// -----------------------------------------------------------------------------------------
// Folder k8s functions
// -----------------------------------------------------------------------------------------

func (fk8s *foldk8sHandler) getClient(ctx context.Context, orgID int64) (dynamic.ResourceInterface, bool) {
	cfg := &rest.Config{
		Host:    fk8s.cfg.AppURL,
		APIPath: "/apis",
		TLSClientConfig: rest.TLSClientConfig{
			Insecure: true, // Skip TLS verification
		},
		Username: fk8s.cfg.AdminUser,
		Password: fk8s.cfg.AdminPassword,
	}

	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, false
	}
	return dyn.Resource(fk8s.gvr).Namespace(fk8s.getNamespace(orgID)), true
}

func (fk8s *foldk8sHandler) getNamespace(orgID int64) string {
	return fk8s.namespacer(orgID)
}

func (s *Service) getK8sContext(ctx context.Context) (context.Context, context.CancelFunc, error) {
	requester, requesterErr := identity.GetRequester(ctx)
	if requesterErr != nil {
		return nil, nil, requesterErr
	}

	user, exists := k8sRequest.UserFrom(ctx)
	if !exists {
		// add in k8s user if not there yet
		var ok bool
		user, ok = requester.(k8sUser.Info)
		if !ok {
			return nil, nil, fmt.Errorf("could not convert user to k8s user")
		}
	}

	newCtx := k8sRequest.WithUser(context.Background(), user)
	newCtx = log.WithContextualAttributes(newCtx, log.FromContext(ctx))
	// TODO: after GLSA token workflow is removed, make this return early
	// and move the else below to be unconditional
	if requesterErr == nil {
		newCtxWithRequester := identity.WithRequester(newCtx, requester)
		newCtx = newCtxWithRequester
	}

	// inherit the deadline from the original context, if it exists
	deadline, ok := ctx.Deadline()
	if ok {
		var newCancel context.CancelFunc
		newCtx, newCancel = context.WithTimeout(newCtx, time.Until(deadline))
		return newCtx, newCancel, nil
	}

	return newCtx, nil, nil
}
