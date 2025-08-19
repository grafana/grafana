package signature

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type grafanaSigner struct{}

// FIXME: where should we use this default signature?
// NewGrafanaSigner returns a Signer that uses the grafana user as the author
func NewGrafanaSigner() Signer {
	return &grafanaSigner{}
}

func (s *grafanaSigner) Sign(ctx context.Context, item utils.GrafanaMetaAccessor) (context.Context, error) {
	sig := repository.CommitSignature{
		Name: "grafana",
		// TODO: should we add email?
		// 	Email: "grafana@grafana.com",
	}

	t, err := item.GetUpdatedTimestamp()
	if err == nil && t != nil {
		sig.When = *t
	} else {
		sig.When = item.GetCreationTimestamp().Time
	}

	return repository.WithAuthorSignature(ctx, sig), nil
}
