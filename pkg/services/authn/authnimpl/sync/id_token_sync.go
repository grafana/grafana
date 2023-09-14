package sync

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type IDTokenSync struct {
	log      log.Logger
	signer   auth.IDSignerService
	features featuremgmt.FeatureToggles
}

func ProvideIDTokenSync(signer auth.IDSignerService, features featuremgmt.FeatureToggles) *IDTokenSync {
	return &IDTokenSync{log: log.New("id-token.sync"), signer: signer, features: features}
}

func (s *IDTokenSync) SyncIDTokenHook(ctx context.Context, identity *authn.Identity, req *authn.Request) error {
	if !s.features.IsEnabled(featuremgmt.FlagIdToken) {
		return nil
	}

	// HACK: implement identity.Requester for authn.Identity
	token, err := s.signer.SignIdentity(ctx, identity.SignedInUser(), req.HTTPRequest)
	if err != nil {
		namespace, id := identity.NamespacedID()
		s.log.Error("Failed to sign id token", "err", err, "namespace", namespace, "id", id)
		// for now don't return error so we don't break authentication from this hook
		return nil
	}

	identity.IDToken = token
	return nil
}
