package acimpl

import (
	"context"
	"errors"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
)

func (a *AccessControl) SetLegacyCheckClient(
	client *legacyclient.LegacyClient,
	useExternalGroups bool,
	namespace types.NamespaceFormatter,
) {
	a.legacyCheckClient = client
	a.useExternalGroups = useExternalGroups
	a.legacyNamespace = namespace
}

func (a *AccessControl) evaluateLegacyCheck(
	ctx context.Context,
	user identity.Requester,
	evaluator accesscontrol.Evaluator,
) (bool, error) {
	if a.legacyCheckClient == nil {
		return false, errors.New("legacy check client is not configured")
	}

	request, err := a.buildLegacyCheckRequest(user, evaluator, a.useExternalGroups, a.legacyNamespace)
	if err != nil {
		return false, err
	}

	return a.legacyCheckClient.LegacyCheck(ctx, request)
}
