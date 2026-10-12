package resource

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/authlib/authz"
	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type groupResource map[string]map[string]interface{}

type accessMetrics struct {
	checkDuration              *prometheus.HistogramVec
	compileDuration            *prometheus.HistogramVec
	batchCheckDuration         *prometheus.HistogramVec
	errorsTotal                *prometheus.CounterVec
	missingDelegatedPermission *prometheus.CounterVec
}

func newMetrics(reg prometheus.Registerer) *accessMetrics {
	return &accessMetrics{
		checkDuration: promauto.With(reg).NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "grafana_grpc_authz_limited_client_check_duration_seconds",
				Help: "duration of the access check calls going through the authz service",

				NativeHistogramBucketFactor:     1.1,
				NativeHistogramMaxBucketNumber:  160,
				NativeHistogramMinResetDuration: time.Hour,
			}, []string{"group", "resource", "verb", "allowed"}),
		compileDuration: promauto.With(reg).NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "grafana_grpc_authz_limited_client_compile_duration_seconds",
				Help: "duration of the access compile calls going through the authz service",

				NativeHistogramBucketFactor:     1.1,
				NativeHistogramMaxBucketNumber:  160,
				NativeHistogramMinResetDuration: time.Hour,
			}, []string{"group", "resource", "verb"}),
		batchCheckDuration: promauto.With(reg).NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "grafana_grpc_authz_limited_client_batch_check_duration_seconds",
				Help: "duration of the batch access check calls going through the authz service",

				NativeHistogramBucketFactor:     1.1,
				NativeHistogramMaxBucketNumber:  160,
				NativeHistogramMinResetDuration: time.Hour,
			}, []string{"check_count_bucket"}),
		errorsTotal: promauto.With(reg).NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_grpc_authz_limited_client_errors_total",
				Help: "Number of errors",
			}, []string{"group", "resource", "verb"}),
		missingDelegatedPermission: promauto.With(reg).NewCounterVec(
			prometheus.CounterOpts{
				Name: "grafana_grpc_authz_limited_client_missing_delegated_permission_total",
				Help: "Number of access checks refused because this service's token cannot act on behalf of a user for the group and resource",
			}, []string{"group", "resource", "verb"}),
	}
}

// ErrServiceCannotDelegate is returned instead of the denial authlib would
// answer on its own, without asking the authz service. That denial is
// indistinguishable from the user lacking access, so a deployment mistake shows
// up as missing results rather than as a failure.
var ErrServiceCannotDelegate = errors.New("this service's token has no delegated permission for the resource")

// ErrServicePermissionMissing distinguishes a service denial from a user denial.
var ErrServicePermissionMissing = errors.New("this service's token has no permission for the resource")

func checkServiceTokenPermissions(id claims.AuthInfo, group, resource, verb string) error {
	res := authz.CheckServicePermissions(id, group, resource, verb)
	if res.Allowed {
		return nil
	}

	// Tokenless callers need the underlying client's local authorization rules.
	// A verified token with empty permissions must not receive this exemption.
	if id.GetAccessToken() == "" && len(id.GetTokenPermissions()) == 0 && len(id.GetTokenDelegatedPermissions()) == 0 {
		return nil
	}

	missing := ErrServiceCannotDelegate
	if res.ServiceCall {
		missing = ErrServicePermissionMissing
	}
	return fmt.Errorf("%w: %s/%s:%s", missing, group, resource, verb)
}

func (c authzLimitedClient) serviceCanDelegate(ctx context.Context, id claims.AuthInfo, group, resource, verb string) error {
	err := checkServiceTokenPermissions(id, group, resource, verb)
	if err == nil {
		return nil
	}
	if errors.Is(err, ErrServicePermissionMissing) {
		c.metrics.errorsTotal.WithLabelValues(group, resource, verb).Inc()
	} else {
		c.metrics.missingDelegatedPermission.WithLabelValues(group, resource, verb).Inc()
	}
	c.logger.FromContext(ctx).Error(
		"Refusing access check: missing service permission",
		"error", err,
		"group", group,
		"resource", resource,
		"verb", verb,
		"subject", id.GetSubject(),
		"required_permission", fmt.Sprintf("%s/%s:%s", group, resource, verb),
	)
	return err
}

// Check before scanning so an empty index cannot hide a missing service grant.
func (s *searchServer) checkSearchServicePermissions(ctx context.Context, req *resourcepb.ResourceSearchRequest) error {
	id, ok := claims.AuthInfoFrom(ctx)
	if !ok || id == nil {
		if s.access == nil {
			return nil
		}
		return apierrors.NewUnauthorized(authz.ErrMissingAuthInfo.Error())
	}
	key := req.Options.Key
	if !claims.NamespaceMatches(id.GetNamespace(), key.Namespace) {
		return claims.ErrNamespaceMismatch
	}

	verb := utils.VerbGet
	if req.Permission == int64(dashboardaccess.PERMISSION_EDIT) {
		verb = utils.VerbUpdate
	}
	if req.IsDeleted {
		verb = utils.VerbSetPermissions
	}
	resources := indexSources(NamespacedResource{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource})
	for _, resource := range resources {
		if err := s.checkSearchServicePermission(ctx, id, resource.Group, resource.Resource, verb); err != nil {
			return err
		}
	}
	for _, resource := range req.Federated {
		if err := s.checkSearchServicePermission(ctx, id, resource.Group, resource.Resource, utils.VerbGet); err != nil {
			return err
		}
	}
	return nil
}

func (s *searchServer) checkSearchServicePermission(ctx context.Context, id claims.AuthInfo, group, resource, verb string) error {
	err := checkServiceTokenPermissions(id, group, resource, verb)
	if err == nil {
		return nil
	}
	mode := "direct"
	if errors.Is(err, ErrServiceCannotDelegate) {
		mode = "delegated"
	}
	if access, ok := s.access.(interface{ IsCompatibleWithRBAC(string, string) bool }); ok && !access.IsCompatibleWithRBAC(group, resource) {
		s.indexMetrics.SearchServicePermissionExemptions.WithLabelValues(group, resource, mode).Inc()
		return nil
	}
	s.indexMetrics.SearchServicePermissionFailures.WithLabelValues(mode).Inc()
	s.log.FromContext(ctx).Error("Search service permission check failed", "error", err,
		"group", group, "resource", resource, "verb", verb, "subject", id.GetSubject(),
		"required_permission", fmt.Sprintf("%s/%s:%s", group, resource, verb))
	return err
}

// batchSizeBucket keeps the batch size out of the label value, which would
// otherwise add a series per size. Ranges cover 1 to batchCheckChunkSize (50),
// the sizes search produces, and are spelled out so changing that constant
// cannot reshape existing series unnoticed.
func batchSizeBucket(n int) string {
	switch {
	case n <= 1:
		return "1"
	case n <= 10:
		return "2-10"
	case n <= 25:
		return "11-25"
	case n <= 50:
		return "26-50"
	default:
		return "51+"
	}
}

// rbacAllowlist is a map of group to resources that are compatible with RBAC.
var rbacAllowlist = groupResource{
	"dashboard.grafana.app": map[string]interface{}{"dashboards": nil, "variables": nil},
	"folder.grafana.app":    map[string]interface{}{"folders": nil},
	"iam.grafana.app":       map[string]interface{}{"users": nil, "teams": nil, "serviceaccounts": nil},
}

// authzLimitedClient is a client that enforces RBAC for the limited number of groups and resources.
// This is a temporary solution until the authz service is fully implemented.
// The authz service will be responsible for enforcing RBAC.
// For now, it makes one call to the authz service for each list items. This is known to be inefficient.
type authzLimitedClient struct {
	client claims.AccessClient
	// exemptionEnabled inverts the gate: every group and resource is enforced,
	// except the exemptions below. Temporary, until every resource is mapped.
	exemptionEnabled bool
	exemptions       groupResource
	logger           log.Logger
	metrics          *accessMetrics
}

type AuthzOptions struct {
	// Registry is where the client's metrics are registered. A nil Registry
	// leaves them unregistered, which is what tests want.
	Registry         prometheus.Registerer
	ExemptionEnabled bool
	ExemptResources  []string
}

// NewAuthzLimitedClient creates a new authzLimitedClient.
func NewAuthzLimitedClient(client claims.AccessClient, opts AuthzOptions) claims.AccessClient {
	logger := log.New("limited-authz-client")
	exemptions, err := parseAuthzExemptions(opts.ExemptResources)
	if err != nil {
		// Callers validate with ValidateAuthzOptions first. Drop the whole list
		// rather than apply part of one that did not parse.
		logger.Error("Ignoring unified storage authz exemptions", "error", err)
	}
	return &authzLimitedClient{
		client:           client,
		exemptionEnabled: opts.ExemptionEnabled,
		exemptions:       exemptions,
		logger:           logger,
		metrics:          newMetrics(opts.Registry),
	}
}

// ValidateAuthzOptions reports exemptions the client would refuse to apply, so
// startup fails instead of running with a list that is silently ignored.
func ValidateAuthzOptions(opts AuthzOptions) error {
	_, err := parseAuthzExemptions(opts.ExemptResources)
	return err
}

// parseAuthzExemptions validates the configured exemptions, whether or not the
// exemption gate is enabled, so a bad value never silently drops enforcement.
func parseAuthzExemptions(values []string) (groupResource, error) {
	exemptions := make(groupResource)
	for _, value := range values {
		group, resource, _ := strings.Cut(value, "/")
		if strings.Count(value, "/") != 1 || strings.Contains(value, "*") || group == "" || resource == "" {
			return nil, fmt.Errorf("invalid unified storage authz exemption %q: expecting an exact group/resource", value)
		}
		if alwaysEnforced(group, resource) {
			return nil, fmt.Errorf("invalid unified storage authz exemption %q: it is already enforced", value)
		}
		if exemptions[group] == nil {
			exemptions[group] = make(map[string]interface{})
		}
		exemptions[group][resource] = nil
	}
	return exemptions, nil
}

func alwaysEnforced(group, resource string) bool {
	if strings.HasSuffix(group, ".ext.grafana.app") {
		return true
	}
	_, ok := rbacAllowlist[group][resource]
	return ok
}

// Check implements claims.AccessClient.
func (c authzLimitedClient) Check(ctx context.Context, id claims.AuthInfo, req claims.CheckRequest, folder string) (claims.CheckResponse, error) {
	t := time.Now()
	ctx, span := tracer.Start(ctx, "resource.authzLimitedClient.Check", trace.WithAttributes(
		attribute.String("group", req.Group),
		attribute.String("resource", req.Resource),
		attribute.String("namespace", req.Namespace),
		attribute.String("name", req.Name),
		attribute.String("verb", req.Verb),
		attribute.String("folder", folder),
	))
	defer span.End()

	if !claims.NamespaceMatches(id.GetNamespace(), req.Namespace) {
		span.SetAttributes(attribute.Bool("allowed", false))
		span.SetStatus(codes.Error, "Namespace mismatch")
		span.RecordError(claims.ErrNamespaceMismatch)
		return claims.CheckResponse{Allowed: false}, claims.ErrNamespaceMismatch
	}

	if !c.IsCompatibleWithRBAC(req.Group, req.Resource) {
		span.SetAttributes(attribute.Bool("allowed", true))
		return claims.CheckResponse{Allowed: true}, nil
	}
	if err := c.serviceCanDelegate(ctx, id, req.Group, req.Resource, req.Verb); err != nil {
		span.SetStatus(codes.Error, err.Error())
		span.RecordError(err)
		return claims.CheckResponse{Allowed: false}, err
	}

	resp, err := c.client.Check(ctx, id, req, folder)
	if err != nil {
		c.logger.FromContext(ctx).Error("Check", "group", req.Group, "resource", req.Resource, "error", err, "duration", time.Since(t))
		c.metrics.errorsTotal.WithLabelValues(req.Group, req.Resource, req.Verb).Inc()
		span.SetStatus(codes.Error, fmt.Sprintf("check failed: %v", err))
		span.RecordError(err)
		return resp, err
	}
	span.SetAttributes(attribute.Bool("allowed", resp.Allowed))
	c.metrics.checkDuration.WithLabelValues(req.Group, req.Resource, req.Verb, fmt.Sprintf("%t", resp.Allowed)).Observe(time.Since(t).Seconds())
	return resp, nil
}

// Compile implements claims.AccessClient.
func (c authzLimitedClient) Compile(ctx context.Context, id claims.AuthInfo, req claims.ListRequest) (claims.ItemChecker, claims.Zookie, error) {
	t := time.Now()
	ctx, span := tracer.Start(ctx, "resource.authzLimitedClient.Compile", trace.WithAttributes(
		attribute.String("group", req.Group),
		attribute.String("resource", req.Resource),
		attribute.String("namespace", req.Namespace),
		attribute.String("verb", req.Verb),
	))
	defer span.End()

	if !claims.NamespaceMatches(id.GetNamespace(), req.Namespace) {
		span.SetAttributes(attribute.Bool("allowed", false))
		span.SetStatus(codes.Error, "Namespace mismatch")
		span.RecordError(claims.ErrNamespaceMismatch)
		return nil, claims.NoopZookie{}, claims.ErrNamespaceMismatch
	}

	if !c.IsCompatibleWithRBAC(req.Group, req.Resource) {
		return func(name, folder string) bool {
			return true
		}, claims.NoopZookie{}, nil
	}
	if err := c.serviceCanDelegate(ctx, id, req.Group, req.Resource, req.Verb); err != nil {
		span.SetStatus(codes.Error, err.Error())
		span.RecordError(err)
		return nil, claims.NoopZookie{}, err
	}

	//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
	checker, zookie, err := c.client.Compile(ctx, id, req)
	if err != nil {
		c.logger.FromContext(ctx).Error("Compile", "group", req.Group, "resource", req.Resource, "error", err)
		c.metrics.errorsTotal.WithLabelValues(req.Group, req.Resource, req.Verb).Inc()
		span.SetStatus(codes.Error, fmt.Sprintf("compile failed: %v", err))
		span.RecordError(err)
		return nil, zookie, err
	}
	c.metrics.compileDuration.WithLabelValues(req.Group, req.Resource, req.Verb).Observe(time.Since(t).Seconds())
	return checker, zookie, nil
}

func (c authzLimitedClient) IsCompatibleWithRBAC(group, resource string) bool {
	// When the allow list is disabled, *.ext.grafana.app groups are additionally
	// forwarded to the underlying authz client so the new dual-check path runs
	// for K8s-native CRDs. This mirrors narrowing in
	// rbac.Service.checkPermission and keeps folder/dashboard/iam flow on the
	// existing allow-list path.
	if alwaysEnforced(group, resource) {
		return true
	}
	if !c.exemptionEnabled {
		return false
	}
	_, exempt := c.exemptions[group][resource]
	return !exempt
}

func (c authzLimitedClient) BatchCheck(ctx context.Context, id claims.AuthInfo, req claims.BatchCheckRequest) (claims.BatchCheckResponse, error) {
	t := time.Now()
	ctx, span := tracer.Start(ctx, "resource.authzLimitedClient.BatchCheck", trace.WithAttributes(
		attribute.String("namespace", req.Namespace),
		attribute.String("subject", id.GetSubject()),
		attribute.Int("check_count", len(req.Checks)),
	))
	defer span.End()

	results := make(map[string]claims.BatchCheckResult, len(req.Checks))

	// Validate namespace matches
	if !claims.NamespaceMatches(id.GetNamespace(), req.Namespace) {
		span.SetStatus(codes.Error, "Namespace mismatch")
		span.RecordError(claims.ErrNamespaceMismatch)
		return claims.BatchCheckResponse{}, claims.ErrNamespaceMismatch
	}

	// Build a separate request for items that need to be checked by the underlying client
	var itemsToCheck []claims.BatchCheckItem
	for _, item := range req.Checks {
		if !c.IsCompatibleWithRBAC(item.Group, item.Resource) {
			// Not compatible with RBAC, allow by default
			results[item.CorrelationID] = claims.BatchCheckResult{Allowed: true}
		} else {
			// Will be checked by underlying client
			itemsToCheck = append(itemsToCheck, item)
		}
	}

	// If all items were allowed by default, return early
	if len(itemsToCheck) == 0 {
		return claims.BatchCheckResponse{Results: results}, nil
	}

	// Once per group, resource and verb: a page of hits repeats the same combination.
	seen := make(map[string]struct{}, len(itemsToCheck))
	for _, item := range itemsToCheck {
		key := item.Group + "/" + item.Resource + ":" + item.Verb
		if _, dup := seen[key]; dup {
			continue
		}
		seen[key] = struct{}{}
		if err := c.serviceCanDelegate(ctx, id, item.Group, item.Resource, item.Verb); err != nil {
			span.SetStatus(codes.Error, err.Error())
			span.RecordError(err)
			return claims.BatchCheckResponse{}, err
		}
	}

	// Forward to the underlying client
	batchReq := claims.BatchCheckRequest{
		Namespace: req.Namespace,
		Checks:    itemsToCheck,
		SkipCache: req.SkipCache,
	}
	resp, err := c.client.BatchCheck(ctx, id, batchReq)
	if err == nil {
		// FilterAuthorized only reads Allowed, so errors must reach it at batch level.
		for _, item := range itemsToCheck {
			result, ok := resp.Results[item.CorrelationID]
			if !ok {
				err = fmt.Errorf("missing authorization result for %s", item.CorrelationID)
				break
			}
			if result.Error != nil {
				err = result.Error
				break
			}
		}
	}
	if err != nil {
		c.logger.FromContext(ctx).Error("BatchCheck", "error", err, "duration", time.Since(t))
		c.metrics.errorsTotal.WithLabelValues("", "", "batch_check").Inc()
		span.SetStatus(codes.Error, fmt.Sprintf("batch check failed: %v", err))
		span.RecordError(err)
		return claims.BatchCheckResponse{}, err
	}

	// Merge results from underlying client
	maps.Copy(results, resp.Results)

	c.metrics.batchCheckDuration.WithLabelValues(batchSizeBucket(len(req.Checks))).Observe(time.Since(t).Seconds())
	return claims.BatchCheckResponse{Results: results}, nil
}

var _ claims.AccessClient = (*authzLimitedClient)(nil)
