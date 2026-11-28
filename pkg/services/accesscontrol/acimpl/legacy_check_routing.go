package acimpl

import (
	"context"
	"errors"

	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
)

var _ legacyclient.LegacyCheckClientSetter = (*AccessControl)(nil)

func (a *AccessControl) SetLegacyCheckClient(
	client legacyclient.LegacyAccessClient,
	namespace types.NamespaceFormatter,
	reg prometheus.Registerer,
) error {
	comparison, err := newLegacyCheckShadow(reg)
	if err != nil {
		return err
	}
	a.legacyCheckShadow = comparison
	a.legacyCheckClient = client
	a.legacyNamespace = namespace
	return nil
}

func (a *AccessControl) evaluateLegacyCheck(
	ctx context.Context,
	user identity.Requester,
	evaluator accesscontrol.Evaluator,
) (bool, error) {
	if a.legacyCheckClient == nil {
		return false, errors.New("legacy check client is not configured")
	}

	request, err := a.buildLegacyCheckRequest(user, evaluator, a.legacyNamespace)
	if err != nil {
		return false, err
	}

	return a.legacyCheckClient.LegacyCheck(ctx, request)
}
