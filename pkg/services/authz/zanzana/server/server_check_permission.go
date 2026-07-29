package server

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	grpccodes "google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) CheckPermission(ctx context.Context, r *authzextv1.CheckPermissionRequest) (*authzextv1.CheckPermissionResponse, error) {
	release, err := s.acquireSlot("CheckPermission", r.GetNamespace())
	if err != nil {
		return nil, err
	}
	defer release()

	// A permission check may be the first request observed for a namespace. Ensure
	// its store exists; newly created stores are reconciled before this returns.
	if err := s.mtReconciler.EnsureNamespace(ctx, r.GetNamespace()); err != nil {
		return nil, fmt.Errorf("failed to reconcile namespace: %w", err)
	}

	res, err := s.checkPermission(ctx, r)
	if err != nil {
		s.logger.Error("failed to perform legacy permission check", "error", err, "namespace", r.GetNamespace(), "action", r.GetAction())
		// Keep translation and OpenFGA details server-side. Grafana only needs an
		// error so the configured primary-engine policy can fail closed.
		return nil, errors.New("failed to perform legacy permission check")
	}
	return res, nil
}

func (s *Server) checkPermission(ctx context.Context, r *authzextv1.CheckPermissionRequest) (*authzextv1.CheckPermissionResponse, error) {
	// Authorize the caller for the namespace before validating request details so
	// an unauthorized caller cannot probe another tenant's permission model.
	if err := authorize(ctx, r.GetNamespace(), s.cfg); err != nil {
		return nil, err
	}
	if r.GetNamespace() == "" {
		return nil, status.Error(grpccodes.InvalidArgument, "namespace is required")
	}
	if r.GetAction() == "" {
		return nil, status.Error(grpccodes.InvalidArgument, "action is required")
	}
	if zanzana.ClassifyPermission(zanzana.RolePermission{Action: r.GetAction()}) == zanzana.Invalid {
		return nil, status.Error(grpccodes.InvalidArgument, "invalid action")
	}

	typ, identifier, err := types.ParseTypeID(r.GetSubject())
	if err != nil || identifier == "" || !types.IsIdentityType(typ, types.TypeUser, types.TypeServiceAccount, types.TypeAnonymous) {
		return nil, status.Error(grpccodes.InvalidArgument, "unsupported canonical subject UID")
	}

	store, err := s.getStoreInfo(ctx, r.GetNamespace())
	if err != nil {
		return nil, fmt.Errorf("failed to get openfga store: %w", err)
	}
	contextuals, err := s.getContextuals(r.GetSubject(), r.GetTeams())
	if err != nil {
		return nil, fmt.Errorf("failed to get contextual tuples: %w", err)
	}
	// Native scoped grants do not emit generic action markers. A scopeless native
	// check must therefore ask whether any native object is reachable for the action.
	if hasScopelessPermission(r.GetScopes()) && zanzana.IsNativeAction(r.GetAction()) {
		allowed, supported, err := s.checkScopelessNativePermission(ctx, store, contextuals, r)
		if err != nil {
			return nil, err
		}
		if supported && allowed {
			return &authzextv1.CheckPermissionResponse{Allowed: true}, nil
		}
		// A native deny is not final: another role may grant the same action through
		// the generic compatibility model, whose action marker is checked below.
	}

	checks, err := buildPermissionChecks(r.GetSubject(), r.GetAction(), r.GetScopes())
	if err != nil {
		return nil, status.Error(grpccodes.InvalidArgument, err.Error())
	}
	if len(checks) == 0 {
		return &authzextv1.CheckPermissionResponse{}, nil
	}

	results, err := s.doBatchCheck(ctx, store, checks, contextuals)
	if err != nil {
		return nil, err
	}
	// Multiple scopes on one legacy permission are alternatives, so any successful
	// native or fallback check satisfies the evaluator leaf.
	for _, result := range results {
		if result.GetError() != nil {
			return nil, fmt.Errorf("openfga fallback check failed: %s", result.GetError().GetMessage())
		}
		if result.GetAllowed() {
			return &authzextv1.CheckPermissionResponse{Allowed: true}, nil
		}
	}
	return &authzextv1.CheckPermissionResponse{}, nil
}

func hasScopelessPermission(scopes []string) bool {
	if len(scopes) == 0 {
		return true
	}
	for _, scope := range scopes {
		if scope == "" {
			return true
		}
	}
	return false
}

func (s *Server) checkScopelessNativePermission(
	ctx context.Context,
	store *zanzana.StoreInfo,
	contextuals *openfgav1.ContextualTupleKeys,
	r *authzextv1.CheckPermissionRequest,
) (bool, bool, error) {
	group, resource, verb := common.TranslateActionToListParams(r.GetAction())
	if group != "" && resource != "" && verb != "" {
		res, err := s.list(ctx, &authzv1.ListRequest{
			Namespace: r.GetNamespace(),
			Subject:   r.GetSubject(),
			Teams:     r.GetTeams(),
			Group:     group,
			Resource:  resource,
			Verb:      verb,
		})
		if err != nil {
			return false, true, fmt.Errorf("failed to list native permission resources: %w", err)
		}
		return res.GetAll() || len(res.GetItems()) > 0 || len(res.GetFolders()) > 0, true, nil
	}

	tuples := zanzana.ScopelessNativePermissionTuples(r.GetSubject(), r.GetAction())
	if len(tuples) == 0 {
		return false, false, nil
	}
	checks := make([]*openfgav1.BatchCheckItem, 0, len(tuples))
	for i, tuple := range tuples {
		checkContext, err := nativePermissionCheckContext(tuple)
		if err != nil {
			return false, true, err
		}
		checks = append(checks, &openfgav1.BatchCheckItem{
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User: tuple.GetUser(), Relation: tuple.GetRelation(), Object: tuple.GetObject(),
			},
			Context:       checkContext,
			CorrelationId: strconv.Itoa(i),
		})
	}
	results, err := s.doBatchCheck(ctx, store, checks, contextuals)
	if err != nil {
		return false, true, err
	}
	for _, result := range results {
		if result.GetError() != nil {
			return false, true, fmt.Errorf("openfga native permission check failed: %s", result.GetError().GetMessage())
		}
		if result.GetAllowed() {
			return true, true, nil
		}
	}
	return false, true, nil
}

func buildPermissionChecks(subject, action string, requestedScopes []string) ([]*openfgav1.BatchCheckItem, error) {
	scopes := requestedScopes
	if len(scopes) == 0 {
		scopes = []string{""}
	}

	checks := make([]*openfgav1.BatchCheckItem, 0, len(scopes))
	// Alternative scopes and native mappings can converge on the same tuple.
	// Deduplicate before BatchCheck while retaining condition context in the key.
	seen := make(map[string]struct{})
	add := func(relation, object string, checkContext *structpb.Struct) {
		key := relation + "\x00" + object
		if checkContext != nil {
			key += "\x00" + checkContext.String()
		}
		if _, exists := seen[key]; exists {
			return
		}
		seen[key] = struct{}{}
		checks = append(checks, &openfgav1.BatchCheckItem{
			TupleKey: &openfgav1.CheckRequestTupleKey{User: subject, Relation: relation, Object: object},
			Context:  checkContext,
		})
	}

	for _, scope := range scopes {
		kind, attribute, identifier := "", "", ""
		if scope != "" {
			kind, attribute, identifier = accesscontrol.SplitScope(scope)
		}
		translation, err := zanzana.TranslatePermission(subject, zanzana.RolePermission{
			Action: action, Scope: scope, Kind: kind, Attribute: attribute, Identifier: identifier,
		})
		if err != nil {
			return nil, err
		}

		if translation.Kind == zanzana.Native {
			// Native permissions are checked only through their Kubernetes/OpenFGA
			// representation; emitting a fallback check as well would create two truths.
			for _, tuple := range translation.Tuples {
				checkContext, err := nativePermissionCheckContext(tuple)
				if err != nil {
					return nil, err
				}
				add(tuple.GetRelation(), tuple.GetObject(), checkContext)
			}
			continue
		}

		if scope == "" {
			// The fallback action marker represents legacy "has this action anywhere"
			// semantics without requiring the caller to know a concrete scope.
			add(zanzana.RelationGranted, zanzana.FallbackActionObject(action), nil)
			continue
		}
		candidates, err := zanzana.FallbackScopeCandidates(scope)
		if err != nil {
			return nil, err
		}
		// Check the exact scope and every legal containing wildcard because a legacy
		// wildcard grant satisfies requests for its descendants.
		for _, candidate := range candidates {
			add(zanzana.RelationGranted, zanzana.FallbackPermissionObject(action, candidate), nil)
		}
	}

	for i, check := range checks {
		check.CorrelationId = strconv.Itoa(i)
	}
	return checks, nil
}

func nativePermissionCheckContext(tuple *openfgav1.TupleKey) (*structpb.Struct, error) {
	condition := tuple.GetCondition()
	if condition == nil {
		return nil, nil
	}

	// Translation tuples carry write-side condition values. OpenFGA checks need the
	// corresponding request-side field instead of copying that context verbatim.
	switch condition.GetName() {
	case "group_filter":
		groupResource := condition.GetContext().GetFields()["group_resource"].GetStringValue()
		if groupResource == "" {
			return nil, errors.New("native group resource permission is missing condition context")
		}
		return &structpb.Struct{Fields: map[string]*structpb.Value{
			"requested_group": structpb.NewStringValue(groupResource),
		}}, nil
	case "subresource_filter":
		subresources := condition.GetContext().GetFields()["subresources"].GetListValue().GetValues()
		if len(subresources) != 1 || subresources[0].GetStringValue() == "" {
			return nil, errors.New("native subresource permission has invalid condition context")
		}
		return &structpb.Struct{Fields: map[string]*structpb.Value{
			"subresource": structpb.NewStringValue(subresources[0].GetStringValue()),
		}}, nil
	default:
		return nil, fmt.Errorf("unsupported native permission condition %q", condition.GetName())
	}
}
