package acimpl

import (
	"context"
	"errors"
	"strconv"
	"time"

	zclient "github.com/grafana/zanzana/pkg/service/client"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/embedserver"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/setting"
)

var _ accesscontrol.AccessControl = new(AccessControl)

func ProvideAccessControl(cfg *setting.Cfg, embed *embedserver.Service) *AccessControl {
	logger := log.New("accesscontrol")
	c, err := embed.GetClient(context.Background(), "1")
	if err != nil {
		panic(err)
	}

	return &AccessControl{
		cfg, logger, accesscontrol.NewResolvers(logger), c,
	}
}

type evalResult struct {
	descision bool
	runner    string
	err       error
	duration  time.Duration
}

type AccessControl struct {
	cfg       *setting.Cfg
	log       log.Logger
	resolvers accesscontrol.Resolvers
	zclient   *zclient.GRPCClient
}

func (a *AccessControl) Evaluate(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	timer := prometheus.NewTimer(metrics.MAccessEvaluationsSummary)
	defer timer.ObserveDuration()
	metrics.MAccessEvaluationCount.Inc()

	if user == nil || user.IsNil() {
		a.log.Warn("No entity set for access control evaluation")
		return false, nil
	}

	if user.GetID() == "" {
		return false, nil
	}

	res := make(chan evalResult, 2)
	go func() {
		start := time.Now()

		// If the user is in no organization, then the evaluation must happen based on the user's global permissions
		permissions := user.GetPermissions()
		if user.GetOrgID() == accesscontrol.NoOrgID {
			permissions = user.GetGlobalPermissions()
		}
		if len(permissions) == 0 {
			a.debug(ctx, user, "No permissions set", evaluator)
			res <- evalResult{false, "grafana", nil, time.Since(start)}
			return
		}

		a.debug(ctx, user, "Evaluating permissions", evaluator)
		// Test evaluation without scope resolver first, this will prevent 403 for wildcard scopes when resource does not exist
		if evaluator.Evaluate(permissions) {
			res <- evalResult{true, "grafana", nil, time.Since(start)}
			return
		}

		resolvedEvaluator, err := evaluator.MutateScopes(ctx, a.resolvers.GetScopeAttributeMutator(user.GetOrgID()))
		if err != nil {
			if errors.Is(err, accesscontrol.ErrResolverNotFound) {
				res <- evalResult{false, "grafana", nil, 0}
				return
			}
			res <- evalResult{false, "grafana", err, time.Since(start)}
			return
		}

		a.debug(ctx, user, "Evaluating resolved permissions", resolvedEvaluator)
		res <- evalResult{resolvedEvaluator.Evaluate(permissions), "grafana", nil, time.Since(start)}
	}()

	go func() {
		start := time.Now()

		eval, err := evaluator.MutateScopes(ctx, a.resolvers.GetScopeAttributeMutator(user.GetOrgID()))
		if err != nil {
			if !errors.Is(err, accesscontrol.ErrResolverNotFound) {
				res <- evalResult{false, "grafana", err, 0}
				return
			}
			eval = evaluator
		}

		for _, pair := range eval.Pairs() {
			a.log.Info("evaluator", eval.String())

			if pair.Action == "" {
				a.log.Error("empty evaluator")
				continue
			}

			relation, object := zclient.ConvertToRelationObject(pair.Action, pair.Scope, strconv.FormatInt(user.GetOrgID(), 10), "org")
			result, err := a.zclient.Check(ctx, &openfgav1.CheckRequest{
				StoreId: a.zclient.MustStoreID(ctx),
				TupleKey: &openfgav1.CheckRequestTupleKey{
					User:     user.GetID(),
					Relation: relation,
					Object:   object,
				},
				AuthorizationModelId: a.zclient.AuthorizationModelID,
			})

			if err != nil {
				res <- evalResult{false, "zanzana", err, time.Since(start)}
				return
			}

			if !result.Allowed {
				res <- evalResult{false, "zanzana", nil, time.Since(start)}
				return
			}
		}

		res <- evalResult{true, "zanzana", nil, time.Since(start)}
	}()

	first := <-res
	second := <-res
	close(res)

	if first.descision != second.descision {
		a.log.Error("eval result diff", "first", first, "second", second)
	} else {
		a.log.Info("eval result", "first", first, "second", second)
	}

	grafanaResult := first
	if second.runner == "grafana" {
		grafanaResult = second
	}

	return grafanaResult.descision, grafanaResult.err
}

func (a *AccessControl) RegisterScopeAttributeResolver(prefix string, resolver accesscontrol.ScopeAttributeResolver) {
	a.resolvers.AddScopeAttributeResolver(prefix, resolver)
}

func (a *AccessControl) debug(ctx context.Context, ident identity.Requester, msg string, eval accesscontrol.Evaluator) {
	namespace, id := ident.GetNamespacedID()
	a.log.FromContext(ctx).Debug(msg, "namespace", namespace, "id", id, "orgID", ident.GetOrgID(), "permissions", eval.GoString())
}
