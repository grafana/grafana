package authorizer

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/aggregator"
	"github.com/grafana/grafana/pkg/setting"
	"golang.org/x/exp/slices"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

var _ authorizer.Authorizer = &upstreamAuthorizer{}

type upstreamAuthorizer struct {
	log            log.Logger
	remoteServices []aggregator.RemoteService
}

func newUpstreamAuthorizer(cfg *setting.Cfg) (*upstreamAuthorizer, error) {
	// TODO: maybe not the best thing to repeat this parsing logic here, but this works
	cfgSection := cfg.SectionWithEnvOverrides("grafana-apiserver")
	remoteServicesFile := cfgSection.Key("remote_services_file").MustString("")
	remoteServices, err := aggregator.ReadRemoteServices(remoteServicesFile)
	if err != nil {
		return nil, err
	}

	return &upstreamAuthorizer{
		log:            log.New("grafana-apiserver.authorizer.stackid"),
		remoteServices: remoteServices,
	}, nil
}

// currently, only allows allow for readonly on cluster scoped resources to authenticated users
func (auth upstreamAuthorizer) Authorize(ctx context.Context, a authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	_, err = identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, fmt.Sprintf("error getting signed in user: %v", err), nil
	}

	info, err := claims.ParseNamespace(a.GetNamespace())
	if err != nil {
		return authorizer.DecisionDeny, fmt.Sprintf("error reading namespace: %v", err), nil
	}

	// Determine if a cluster scoped resource is aggregated and will be authzed upstream
	if info.Value == "" {
		if found := slices.IndexFunc(auth.remoteServices, func(s aggregator.RemoteService) bool {
			return slices.IndexFunc(s.ClusterScopedResources, func(clusterScopedResource aggregator.ClusterScopedResource) bool {
				return s.Group == a.GetAPIGroup() && clusterScopedResource.Resource == a.GetResource()
			}) != -1
		}); found != -1 {
			fmt.Println("Allowing CSR", a.GetAPIGroup(), a.GetResource())
			return authorizer.DecisionAllow, "", nil
		}
	}

	return authorizer.DecisionNoOpinion, "", nil
}
