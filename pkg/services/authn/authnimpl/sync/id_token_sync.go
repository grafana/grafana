package sync

import (
	"context"

	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type IDTokenSync struct {
	signer   auth.IDSignerService
	features featuremgmt.FeatureToggles
}

func ProvideIDTokenSync(signer auth.IDSignerService, features featuremgmt.FeatureToggles) *IDTokenSync {
	return &IDTokenSync{signer: signer, features: features}
}

func (s *IDTokenSync) SyncIDTokenHook(ctx context.Context, identity *authn.Identity, req *authn.Request) error {
	if !s.features.IsEnabled(featuremgmt.FlagIdToken) {
		return nil
	}

	// HACK: implement identity.Requester for authn.Identity
	token, err := s.signer.SignIdentity(ctx, identity.SignedInUser(), req.HTTPRequest)
	if err != nil {
		return err
	}

	identity.IDToken = token
	return nil
}
