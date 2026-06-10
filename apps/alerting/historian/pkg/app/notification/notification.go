package notification

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/historian/pkg/apis/alertinghistorian/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/historian/pkg/app/config"
)

type Notification struct {
	loki       *LokiReader
	logger     logging.Logger
	ruleAccess config.RuleAccessChecker
}

func New(cfg config.NotificationConfig, reg prometheus.Registerer, logger logging.Logger, tracer trace.Tracer, ruleAccess config.RuleAccessChecker) *Notification {
	if !cfg.Enabled {
		return &Notification{}
	}
	return &Notification{
		loki:       NewLokiReader(cfg.Loki, reg, logger, tracer),
		logger:     logger,
		ruleAccess: ruleAccess,
	}
}

func (n *Notification) QueryAlertsHandler(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	start := time.Now()

	if n.loki == nil {
		const msg = "Notification alerts query whilst disabled"
		n.logger.Debug(msg)
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusUnprocessableEntity,
				Message: msg,
			}}
	}

	var body v0alpha1.CreateNotificationsqueryalertsRequestBody
	err := json.NewDecoder(request.Body).Decode(&body)
	if err != nil {
		const msg = "Notification alerts query malformed"
		n.logger.Debug(msg, "err", err)
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusBadRequest,
				Message: fmt.Sprintf("%s: %s", msg, err.Error()),
			}}
	}

	response, err := n.loki.QueryAlerts(ctx, body)
	if err != nil {
		if errors.Is(err, ErrInvalidQuery) {
			const msg = "Notification alerts query invalid"
			n.logger.Debug(msg, "err", err)
			return &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Status:  metav1.StatusFailure,
					Code:    http.StatusBadRequest,
					Message: fmt.Sprintf("%s: %s", msg, err.Error()),
				}}
		}
		const msg = "Notification alerts query failed"
		n.logger.Error(msg, "err", err, "duration", time.Since(start))
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("%s: %s", msg, err.Error()),
			}}
	}

	n.logger.Debug("Notification alerts query success",
		"alerts", len(response.Alerts),
		"duration", time.Since(start))

	writer.Header().Add("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	return json.NewEncoder(writer).Encode(response)
}

func (n *Notification) QueryHandler(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	start := time.Now()

	if n.loki == nil {
		const msg = "Notification history query whilst disabled"
		n.logger.Debug(msg)
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusUnprocessableEntity,
				Message: msg,
			}}
	}

	var body v0alpha1.CreateNotificationqueryRequestBody
	err := json.NewDecoder(request.Body).Decode(&body)
	if err != nil {
		const msg = "Notification history query malformed"
		n.logger.Debug(msg, "err", err)
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusBadRequest,
				Message: fmt.Sprintf("%s: %s", msg, err.Error()),
			}}
	}

	if err := n.checkSingleRuleAccess(ctx, body.RuleUID); err != nil {
		return err
	}

	response, err := n.loki.Query(ctx, body)
	if err != nil {
		if errors.Is(err, ErrInvalidQuery) {
			const msg = "Notification history query invalid"
			n.logger.Debug(msg, "err", err)
			return &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Status:  metav1.StatusFailure,
					Code:    http.StatusBadRequest,
					Message: fmt.Sprintf("%s: %s", msg, err.Error()),
				}}
		}
		const msg = "Notification history query failed"
		n.logger.Error(msg, "err", err, "duration", time.Since(start))
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("%s: %s", msg, err.Error()),
			}}
	}

	response.Entries, err = n.filterEntries(ctx, response.Entries)
	if err != nil {
		n.logger.Error("Notification history RBAC filter failed", "err", err, "duration", time.Since(start))
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to filter notification history: %s", err.Error()),
			}}
	}

	response.Counts, err = n.filterCounts(ctx, response.Counts)
	if err != nil {
		n.logger.Error("Notification history RBAC count filter failed", "err", err, "duration", time.Since(start))
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to filter notification history counts: %s", err.Error()),
			}}
	}

	n.logger.Debug("Notification history query success",
		"entries", len(response.Entries),
		"counts", len(response.Counts),
		"duration", time.Since(start))

	writer.Header().Add("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	return json.NewEncoder(writer).Encode(response)
}

// checkSingleRuleAccess rejects the request early when the query targets a
// specific rule that the user cannot read. Returns nil if no RuleUID filter is
// set, if no access checker is configured, or if access is allowed.
func (n *Notification) checkSingleRuleAccess(ctx context.Context, ruleUID *string) error {
	if n.ruleAccess == nil || ruleUID == nil || *ruleUID == "" {
		return nil
	}
	canReadAll, err := n.ruleAccess.CanReadAllRules(ctx)
	if err != nil {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to check rule access: %s", err.Error()),
			}}
	}
	if canReadAll {
		return nil
	}
	accessible, err := n.ruleAccess.AccessibleRuleUIDs(ctx, []string{*ruleUID})
	if err != nil {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusInternalServerError,
				Message: fmt.Sprintf("failed to check rule access: %s", err.Error()),
			}}
	}
	if !accessible[*ruleUID] {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusForbidden,
				Message: "you do not have access to the requested alert rule",
			}}
	}
	return nil
}

// filterEntries removes notification entries whose rules the user cannot read.
// An entry is kept if the user can read at least one of its associated rules.
func (n *Notification) filterEntries(ctx context.Context, entries []Entry) ([]Entry, error) {
	if n.ruleAccess == nil || len(entries) == 0 {
		return entries, nil
	}
	canReadAll, err := n.ruleAccess.CanReadAllRules(ctx)
	if err != nil {
		return nil, err
	}
	if canReadAll {
		return entries, nil
	}

	allUIDs := collectRuleUIDs(entries)
	if len(allUIDs) == 0 {
		return entries, nil
	}

	accessible, err := n.ruleAccess.AccessibleRuleUIDs(ctx, allUIDs)
	if err != nil {
		return nil, err
	}

	filtered := make([]Entry, 0, len(entries))
	for _, entry := range entries {
		if hasAccessibleRule(entry.RuleUIDs, accessible) {
			filtered = append(filtered, entry)
		}
	}
	return filtered, nil
}

// filterCounts removes count entries whose rule the user cannot read.
// Counts with a RuleUID field are filtered; counts without one are kept as-is.
func (n *Notification) filterCounts(ctx context.Context, counts []Count) ([]Count, error) {
	if n.ruleAccess == nil || len(counts) == 0 {
		return counts, nil
	}
	canReadAll, err := n.ruleAccess.CanReadAllRules(ctx)
	if err != nil {
		return nil, err
	}
	if canReadAll {
		return counts, nil
	}

	uids := make([]string, 0)
	for _, c := range counts {
		if c.RuleUID != nil && *c.RuleUID != "" {
			uids = append(uids, *c.RuleUID)
		}
	}
	if len(uids) == 0 {
		return counts, nil
	}

	accessible, err := n.ruleAccess.AccessibleRuleUIDs(ctx, uids)
	if err != nil {
		return nil, err
	}

	filtered := make([]Count, 0, len(counts))
	for _, c := range counts {
		if c.RuleUID == nil || *c.RuleUID == "" || accessible[*c.RuleUID] {
			filtered = append(filtered, c)
		}
	}
	return filtered, nil
}

func collectRuleUIDs(entries []Entry) []string {
	seen := make(map[string]struct{})
	for _, e := range entries {
		for _, uid := range e.RuleUIDs {
			seen[uid] = struct{}{}
		}
	}
	uids := make([]string, 0, len(seen))
	for uid := range seen {
		uids = append(uids, uid)
	}
	return uids
}

func hasAccessibleRule(ruleUIDs []string, accessible map[string]bool) bool {
	if len(ruleUIDs) == 0 {
		return true
	}
	for _, uid := range ruleUIDs {
		if accessible[uid] {
			return true
		}
	}
	return false
}
