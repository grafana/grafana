package search

import (
	"net/url"
	"sort"
	"strconv"
	"strings"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

// parseParams decodes the request query string into the generated (superset)
// request params type, so the handler input matches the documented API.
func parseParams(v url.Values) model.GetSearchRulesRequestParams {
	p := model.GetSearchRulesRequestParams{
		Q:                   strPtr(v, "q"),
		Folders:             v["folders"],
		Groups:              v["groups"],
		DatasourceUIDs:      v["datasourceUIDs"],
		Labels:              v["labels"],
		ContinueToken:       strPtr(v, "continueToken"),
		Type:                strPtr(v, "type"),
		DashboardUID:        strPtr(v, "dashboardUID"),
		Receiver:            strPtr(v, "receiver"),
		NotificationType:    strPtr(v, "notificationType"),
		RoutingTree:         strPtr(v, "routingTree"),
		Metric:              strPtr(v, "metric"),
		TargetDatasourceUID: strPtr(v, "targetDatasourceUID"),
	}
	if s := v.Get("paused"); s != "" {
		if b, err := strconv.ParseBool(s); err == nil {
			p.Paused = &b
		}
	}
	if s := v.Get("limit"); s != "" {
		if n, err := strconv.ParseInt(s, 10, 64); err == nil && n >= 0 {
			p.Limit = &n
		}
	}
	if s := v.Get("panelID"); s != "" {
		if n, err := strconv.ParseInt(s, 10, 64); err == nil {
			p.PanelID = &n
		}
	}
	if s := v.Get("sort"); s != "" {
		f := model.GetSearchRulesRequestRuleSearchSortField(s)
		p.Sort = &f
	}
	return p
}

func strPtr(v url.Values, key string) *string {
	if s := v.Get(key); s != "" {
		return &s
	}
	return nil
}

func strVal(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func limit(p model.GetSearchRulesRequestParams) int64 {
	if p.Limit == nil {
		return 0
	}
	return *p.Limit
}

func panelID(p model.GetSearchRulesRequestParams) string {
	if p.PanelID == nil {
		return ""
	}
	return strconv.FormatInt(*p.PanelID, 10)
}

// sortSpec splits a sort field value into the field name and descending flag
// ("-title" -> "title", desc).
func sortSpec(field *model.GetSearchRulesRequestRuleSearchSortField) (string, bool) {
	if field == nil {
		return "", false
	}
	s := string(*field)
	return strings.TrimPrefix(s, "-"), strings.HasPrefix(s, "-")
}

type labelMatcher struct {
	key   string
	value string
	op    matcherOp
}

type matcherOp int

const (
	matchEquals matcherOp = iota
	matchNotEquals
	matchExists
	matchNotExists
)

func parseLabelMatchers(raw []string) []labelMatcher {
	matchers := make([]labelMatcher, 0, len(raw))
	for _, s := range raw {
		if s == "" {
			continue
		}
		matchers = append(matchers, parseLabelMatcher(s))
	}
	return matchers
}

func parseLabelMatcher(s string) labelMatcher {
	if rest, ok := strings.CutPrefix(s, "!"); ok {
		return labelMatcher{key: rest, op: matchNotExists}
	}
	if k, v, ok := strings.Cut(s, "!="); ok {
		return labelMatcher{key: k, value: v, op: matchNotEquals}
	}
	if k, v, ok := strings.Cut(s, "="); ok {
		return labelMatcher{key: k, value: v, op: matchEquals}
	}
	return labelMatcher{key: s, op: matchExists}
}

func matchText(r *ngmodels.AlertRule, text string) bool {
	if text == "" {
		return true
	}
	return strings.Contains(strings.ToLower(r.Title), strings.ToLower(text))
}

// matchLabels returns true when every matcher holds against the rule labels.
func matchLabels(r *ngmodels.AlertRule, matchers []labelMatcher) bool {
	for _, m := range matchers {
		v, ok := r.Labels[m.key]
		switch m.op {
		case matchExists:
			if !ok {
				return false
			}
		case matchNotExists:
			if ok {
				return false
			}
		case matchEquals:
			if !ok || v != m.value {
				return false
			}
		case matchNotEquals:
			if ok && v == m.value {
				return false
			}
		}
	}
	return true
}

// serverSideDatasourceUIDs are the synthetic datasources used for expression
// nodes; they are never user-facing query datasources.
var serverSideDatasourceUIDs = map[string]struct{}{
	expr.DatasourceUID:    {},
	expr.OldDatasourceUID: {},
	expr.MLDatasourceUID:  {},
}

// matchDatasources returns true when the rule references any of the requested
// source datasources in its query expressions.
func matchDatasources(r *ngmodels.AlertRule, uids []string) bool {
	if len(uids) == 0 {
		return true
	}
	have := make(map[string]struct{}, len(r.Data))
	for _, q := range r.Data {
		if _, server := serverSideDatasourceUIDs[q.DatasourceUID]; server || q.DatasourceUID == "" {
			continue
		}
		have[q.DatasourceUID] = struct{}{}
	}
	for _, want := range uids {
		if _, ok := have[want]; ok {
			return true
		}
	}
	return false
}

func sortRules(rules []*ngmodels.AlertRule, field string, desc bool) {
	var less func(a, b *ngmodels.AlertRule) bool
	switch field {
	case "group":
		// Compound key keeps each group together and in evaluation order.
		less = func(a, b *ngmodels.AlertRule) bool {
			if a.NamespaceUID != b.NamespaceUID {
				return a.NamespaceUID < b.NamespaceUID
			}
			if a.RuleGroup != b.RuleGroup {
				return a.RuleGroup < b.RuleGroup
			}
			if a.RuleGroupIndex != b.RuleGroupIndex {
				return a.RuleGroupIndex < b.RuleGroupIndex
			}
			return a.Title < b.Title
		}
	default:
		less = func(a, b *ngmodels.AlertRule) bool {
			if a.Title != b.Title {
				return a.Title < b.Title
			}
			return a.UID < b.UID
		}
	}
	sort.SliceStable(rules, func(i, j int) bool {
		if desc {
			return less(rules[j], rules[i])
		}
		return less(rules[i], rules[j])
	})
}

// paginate slices the (already filtered and sorted) rules using an offset
// encoded in the continue token. It returns the page and the token for the
// next page, which is empty when the last page is reached.
func paginate(rules []*ngmodels.AlertRule, continueToken string, limit int64) ([]*ngmodels.AlertRule, string) {
	offset := 0
	if continueToken != "" {
		if n, err := strconv.Atoi(continueToken); err == nil && n > 0 {
			offset = n
		}
	}
	if offset > len(rules) {
		offset = len(rules)
	}
	rules = rules[offset:]
	if limit <= 0 || int64(len(rules)) <= limit {
		return rules, ""
	}
	return rules[:limit], strconv.Itoa(offset + int(limit))
}

func includeFilter(values []string) provisioning.ListRuleStringFilter {
	if len(values) == 0 {
		return provisioning.ListRuleStringFilter{}
	}
	return provisioning.ListRuleStringFilter{Include: values}
}

func stringFilter(value string) provisioning.ListRuleStringFilter {
	if value == "" {
		return provisioning.ListRuleStringFilter{}
	}
	return provisioning.ListRuleStringFilter{Include: []string{value}}
}
