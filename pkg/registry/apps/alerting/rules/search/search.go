package search

import (
	"context"
	"encoding/json"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

// Handler serves the rule search custom routes. It queries rules through the
// provisioning service (legacy storage) and applies the filters that cannot be
// expressed as field/label selectors (free-text title, rule-label matchers and
// source datasource) plus sorting and pagination in memory.
type Handler struct {
	service    provisioning.AlertRuleService
	namespacer request.NamespaceMapper
	logger     log.Logger
}

func NewHandler(service provisioning.AlertRuleService, namespacer request.NamespaceMapper) *Handler {
	return &Handler{
		service:    service,
		namespacer: namespacer,
		logger:     log.New("alerting.rules.search"),
	}
}

func (h *Handler) SearchAlertRules(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	page, err := h.collect(ctx, req, ngmodels.RuleTypeFilterAlerting)
	if err != nil {
		return err
	}
	items := make([]model.GetSearchAlertRulesAlertRuleHit, 0, len(page.rules))
	for _, r := range page.rules {
		obj, err := alertrule.ConvertToK8sResource(page.orgID, r, page.provenances[r.UID], h.namespacer)
		if err != nil {
			h.skip(ctx, r, err)
			continue
		}
		var spec model.GetSearchAlertRulesAlertRuleSpec
		if err := reencode(obj.Spec, &spec); err != nil {
			h.skip(ctx, r, err)
			continue
		}
		items = append(items, model.GetSearchAlertRulesAlertRuleHit{Metadata: obj.ObjectMeta, Spec: spec})
	}
	return writeJSON(w, &model.GetSearchAlertRulesResponse{
		TypeMeta:                listTypeMeta,
		ListMeta:                metav1.ListMeta{Continue: page.continueToken},
		GetSearchAlertRulesBody: model.GetSearchAlertRulesBody{Items: items},
	})
}

func (h *Handler) SearchRecordingRules(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	page, err := h.collect(ctx, req, ngmodels.RuleTypeFilterRecording)
	if err != nil {
		return err
	}
	items := make([]model.GetSearchRecordingRulesRecordingRuleHit, 0, len(page.rules))
	for _, r := range page.rules {
		obj, err := recordingrule.ConvertToK8sResource(page.orgID, r, page.provenances[r.UID], h.namespacer)
		if err != nil {
			h.skip(ctx, r, err)
			continue
		}
		var spec model.GetSearchRecordingRulesRecordingRuleSpec
		if err := reencode(obj.Spec, &spec); err != nil {
			h.skip(ctx, r, err)
			continue
		}
		items = append(items, model.GetSearchRecordingRulesRecordingRuleHit{Metadata: obj.ObjectMeta, Spec: spec})
	}
	return writeJSON(w, &model.GetSearchRecordingRulesResponse{
		TypeMeta:                    listTypeMeta,
		ListMeta:                    metav1.ListMeta{Continue: page.continueToken},
		GetSearchRecordingRulesBody: model.GetSearchRecordingRulesBody{Items: items},
	})
}

func (h *Handler) SearchRules(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	page, err := h.collect(ctx, req, ngmodels.RuleTypeFilterAll)
	if err != nil {
		return err
	}
	items := make([]model.GetSearchRulesRuleHit, 0, len(page.rules))
	for _, r := range page.rules {
		hit, err := h.crossKindHit(page.orgID, r, page.provenances[r.UID])
		if err != nil {
			h.skip(ctx, r, err)
			continue
		}
		items = append(items, hit)
	}
	return writeJSON(w, &model.GetSearchRulesResponse{
		TypeMeta:           listTypeMeta,
		ListMeta:           metav1.ListMeta{Continue: page.continueToken},
		GetSearchRulesBody: model.GetSearchRulesBody{Items: items},
	})
}

// crossKindHit builds an untyped (spec union) hit for the cross-kind endpoint.
func (h *Handler) crossKindHit(orgID int64, r *ngmodels.AlertRule, provenance ngmodels.Provenance) (model.GetSearchRulesRuleHit, error) {
	if r.Type() == ngmodels.RuleTypeRecording {
		obj, err := recordingrule.ConvertToK8sResource(orgID, r, provenance, h.namespacer)
		if err != nil {
			return model.GetSearchRulesRuleHit{}, err
		}
		return model.GetSearchRulesRuleHit{Metadata: obj.ObjectMeta, Spec: obj.Spec}, nil
	}
	obj, err := alertrule.ConvertToK8sResource(orgID, r, provenance, h.namespacer)
	if err != nil {
		return model.GetSearchRulesRuleHit{}, err
	}
	return model.GetSearchRulesRuleHit{Metadata: obj.ObjectMeta, Spec: obj.Spec}, nil
}

// resultPage is the filtered, sorted and paginated rule set plus the context
// needed to render hits.
type resultPage struct {
	rules         []*ngmodels.AlertRule
	provenances   map[string]ngmodels.Provenance
	orgID         int64
	continueToken string
}

func (h *Handler) collect(ctx context.Context, req *app.CustomRouteRequest, ruleType ngmodels.RuleTypeFilter) (resultPage, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return resultPage{}, apierrors.NewUnauthorized(err.Error())
	}
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return resultPage{}, apierrors.NewBadRequest(err.Error())
	}

	params := parseParams(req.URL.Query())
	if ruleType == ngmodels.RuleTypeFilterAll {
		switch strVal(params.Type) {
		case "alertrule":
			ruleType = ngmodels.RuleTypeFilterAlerting
		case "recordingrule":
			ruleType = ngmodels.RuleTypeFilterRecording
		case "":
		default:
			return resultPage{}, apierrors.NewBadRequest("invalid type: must be one of alertrule, recordingrule")
		}
	}

	// Server-side (selector-backed) filters narrow the set; the remaining
	// filters and ordering are applied in memory, so we fetch the full set.
	rules, provenances, _, err := h.service.ListAlertRules(ctx, user, provisioning.ListAlertRulesOptions{
		RuleType:                  ruleType,
		GroupFilter:               includeFilter(params.Groups),
		FolderFilter:              includeFilter(params.Folders),
		PausedFilter:              provisioning.ListRuleBoolFilter{Value: params.Paused},
		DashboardFilter:           stringFilter(strVal(params.DashboardUID)),
		PanelIDFilter:             stringFilter(panelID(params)),
		NotificationTypeFilter:    stringFilter(strVal(params.NotificationType)),
		ReceiverFilter:            stringFilter(strVal(params.Receiver)),
		RoutingTreeFilter:         stringFilter(strVal(params.RoutingTree)),
		MetricFilter:              stringFilter(strVal(params.Metric)),
		TargetDatasourceUIDFilter: stringFilter(strVal(params.TargetDatasourceUID)),
	})
	if err != nil {
		return resultPage{}, err
	}

	matchers := parseLabelMatchers(params.Labels)
	filtered := rules[:0]
	for _, r := range rules {
		if !matchText(r, strVal(params.Q)) || !matchLabels(r, matchers) || !matchDatasources(r, params.DatasourceUIDs) {
			continue
		}
		filtered = append(filtered, r)
	}

	field, desc := sortSpec(params.Sort)
	sortRules(filtered, field, desc)

	page, token := paginate(filtered, strVal(params.ContinueToken), limit(params))
	return resultPage{rules: page, provenances: provenances, orgID: info.OrgID, continueToken: token}, nil
}

func (h *Handler) skip(ctx context.Context, r *ngmodels.AlertRule, err error) {
	h.logger.FromContext(ctx).Warn("skipping rule that failed conversion", "uid", r.UID, "error", err)
}

var listTypeMeta = metav1.TypeMeta{APIVersion: model.GroupVersion.String(), Kind: "RuleSearchResults"}

// reencode copies src into dst via JSON. The per-kind hit specs are generated
// as route-local types that are JSON-identical to the canonical rule specs.
func reencode(src any, dst any) error {
	b, err := json.Marshal(src)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, dst)
}

func writeJSON(w app.CustomRouteResponseWriter, obj any) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	return json.NewEncoder(w).Encode(obj)
}
