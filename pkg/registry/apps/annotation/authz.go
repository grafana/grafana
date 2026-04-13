package annotation

import (
	"context"
	"fmt"
	"strconv"

	authtypes "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
)

// GetAuthorizer returns the authorizer for the annotation app.
func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(
		ctx context.Context, attr authorizer.Attributes,
	) (authorized authorizer.Decision, reason string, err error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}

		// Allow all authenticated users; fine-grained authz is handled per-operation in k8sRESTAdapter.
		return authorizer.DecisionAllow, "", nil
	})
}

// canAccessAnnotation checks that the caller has permission to perform verb on anno,
// using the legacy annotation authorization model (dashboard-scoped or org-scoped).
func canAccessAnnotation(ctx context.Context, accessClient authtypes.AccessClient, namespace string, anno *annotationV0.Annotation, verb string) (bool, error) {
	if anno == nil {
		return false, apierrors.NewBadRequest("annotation must not be nil")
	}

	authInfo, ok := authtypes.AuthInfoFrom(ctx)
	if !ok {
		return false, apierrors.NewUnauthorized("no identity found for request")
	}

	var checkReq authtypes.CheckRequest

	if anno.Spec.DashboardUID == nil || *anno.Spec.DashboardUID == "" {
		// Org-level annotation: scope is annotations:type:organization.
		checkReq = authtypes.CheckRequest{
			Verb:      verb,
			Group:     "annotation.grafana.app",
			Resource:  "annotations",
			Namespace: namespace,
			Name:      "organization",
		}
	} else {
		// Dashboard annotation: use dashboards/annotations subresource,
		// which maps to annotation actions scoped to dashboards:uid:<dashboardUID>.
		checkReq = authtypes.CheckRequest{
			Verb:        verb,
			Group:       "dashboard.grafana.app",
			Resource:    "dashboards",
			Subresource: "annotations",
			Namespace:   namespace,
			Name:        *anno.Spec.DashboardUID,
		}
	}

	resp, err := accessClient.Check(ctx, authInfo, checkReq, "")
	if err != nil {
		return false, fmt.Errorf("authz check failed: %w", err)
	}

	return resp.Allowed, nil
}

// canAccessAnnotations checks permissions for a batch of annotations,
// returning a boolean slice aligned with the input items slice
func canAccessAnnotations(ctx context.Context, accessClient authtypes.AccessClient, namespace string, items []annotationV0.Annotation, verb string) ([]bool, error) {
	if len(items) == 0 {
		return nil, nil
	}

	authInfo, ok := authtypes.AuthInfoFrom(ctx)
	if !ok {
		return nil, apierrors.NewUnauthorized("no identity found for request")
	}

	checks := make([]authtypes.BatchCheckItem, 0, len(items))
	for i, anno := range items {
		var item authtypes.BatchCheckItem
		item.CorrelationID = strconv.Itoa(i)
		item.Verb = verb

		if anno.Spec.DashboardUID == nil || *anno.Spec.DashboardUID == "" {
			item.Group = "annotation.grafana.app"
			item.Resource = "annotations"
			item.Name = "organization"
		} else {
			item.Group = "dashboard.grafana.app"
			item.Resource = "annotations"
			item.Name = *anno.Spec.DashboardUID
		}

		checks = append(checks, item)
	}

	allowed := make([]bool, len(items))
	for start := 0; start < len(checks); start += authtypes.MaxBatchCheckItems {
		end := min(start+authtypes.MaxBatchCheckItems, len(checks))
		res, err := accessClient.BatchCheck(ctx, authInfo, authtypes.BatchCheckRequest{
			Namespace: namespace,
			Checks:    checks[start:end],
		})
		if err != nil {
			return nil, fmt.Errorf("batch authz check failed: %w", err)
		}
		for id, result := range res.Results {
			if idx, err := strconv.Atoi(id); err == nil {
				allowed[idx] = result.Allowed
			}
		}
	}

	return allowed, nil
}
