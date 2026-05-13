package prometheusrule

import (
	"errors"
	"fmt"
	"time"

	"go.yaml.in/yaml/v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	prom_model "github.com/prometheus/common/model"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/prom"
)

var (
	errInvalidGroup        = errors.New("group is not a converted Prometheus rule group")
	errMissingOriginalRule = errors.New("rule is missing the original Prometheus definition needed for round-trip")
)

const (
	// defaultDatasourceUID matches the well-known Grafana Cloud Mimir datasource UID.
	defaultDatasourceUID = "grafanacloud-prom"
)

// convertToDomainGroups translates the k8s PrometheusRule (multi-group) into one
// Grafana AlertRuleGroup per spec.groups entry. KeepOriginalRuleDefinition is
// forced on so GET/LIST round-trips losslessly via the per-rule YAML preserved in
// rule metadata. Each persisted rule is tagged with SourceLabelKey so reads can
// partition back to the originating PrometheusRule resource.
func convertToDomainGroups(
	orgID int64,
	folderUID string,
	datasourceUID string,
	defaultInterval time.Duration,
	source string,
	pr *model.PrometheusRule,
) ([]*ngmodels.AlertRuleGroup, ngmodels.Provenance, error) {
	if datasourceUID == "" {
		datasourceUID = defaultDatasourceUID
	}

	keep := true
	cfg := prom.Config{
		DatasourceUID:              datasourceUID,
		DatasourceType:             datasources.DS_PROMETHEUS,
		DefaultInterval:            defaultInterval,
		KeepOriginalRuleDefinition: &keep,
	}
	converter, err := prom.NewConverter(cfg)
	if err != nil {
		return nil, "", fmt.Errorf("failed to build converter: %w", err)
	}

	groups := make([]*ngmodels.AlertRuleGroup, 0, len(pr.Spec.Groups))
	for i, g := range pr.Spec.Groups {
		promGroup := specGroupToProm(g)
		grafGroup, err := converter.PrometheusRulesToGrafana(orgID, folderUID, promGroup)
		if err != nil {
			return nil, "", fmt.Errorf("groups[%d] %q: %w", i, g.Name, err)
		}
		// Tag each rule with the source-resource label so reverse reads can
		// partition results back to this PrometheusRule. This is applied after
		// conversion so it does not leak into OriginalRuleDefinition.
		for j := range grafGroup.Rules {
			if grafGroup.Rules[j].Labels == nil {
				grafGroup.Rules[j].Labels = make(map[string]string)
			}
			grafGroup.Rules[j].Labels[SourceLabelKey] = source
		}
		groups = append(groups, grafGroup)
	}

	provenance := ngmodels.ProvenanceConvertedPrometheus
	sourceProv := pr.GetProvenanceStatus()
	if sourceProv != "" && sourceProv != model.ProvenanceStatusNone {
		provenance = ngmodels.Provenance(sourceProv)
	}
	return groups, provenance, nil
}

func specGroupToProm(g model.PrometheusRulePrometheusRuleGroup) prom.PrometheusRuleGroup {
	rules := make([]prom.PrometheusRule, 0, len(g.Rules))
	for _, r := range g.Rules {
		pr := prom.PrometheusRule{
			Expr:        r.Expr,
			Labels:      r.Labels,
			Annotations: r.Annotations,
		}
		if r.Alert != nil {
			pr.Alert = *r.Alert
		}
		if r.Record != nil {
			pr.Record = *r.Record
		}
		if r.For != nil {
			if d, err := prom_model.ParseDuration(string(*r.For)); err == nil {
				pr.For = &d
			}
		}
		if r.KeepFiringFor != nil {
			if d, err := prom_model.ParseDuration(string(*r.KeepFiringFor)); err == nil {
				pr.KeepFiringFor = &d
			}
		}
		rules = append(rules, pr)
	}
	out := prom.PrometheusRuleGroup{
		Name:   g.Name,
		Rules:  rules,
		Labels: g.Labels,
	}
	if g.Interval != nil {
		if d, err := prom_model.ParseDuration(string(*g.Interval)); err == nil {
			out.Interval = d
		}
	}
	if g.QueryOffset != nil {
		if d, err := prom_model.ParseDuration(string(*g.QueryOffset)); err == nil {
			out.QueryOffset = &d
		}
	}
	if g.Limit != nil {
		out.Limit = int(*g.Limit)
	}
	return out
}

// reassembleResource builds a PrometheusRule from the set of AlertRuleGroups that
// share the same source label. Group order is preserved by the caller (the input
// is already partitioned by group key).
func reassembleResource(
	orgID int64,
	sourceName string,
	groups []*ngmodels.AlertRuleGroup,
	provenance ngmodels.Provenance,
	namespaceMapper request.NamespaceMapper,
) (*model.PrometheusRule, error) {
	if len(groups) == 0 {
		return nil, errInvalidGroup
	}

	specGroups := make([]model.PrometheusRulePrometheusRuleGroup, 0, len(groups))
	folderUID := groups[0].FolderUID
	for _, group := range groups {
		rules := make([]model.PrometheusRulePrometheusRuleEntry, 0, len(group.Rules))
		for i, rule := range group.Rules {
			if rule.Metadata.PrometheusStyleRule == nil || rule.Metadata.PrometheusStyleRule.OriginalRuleDefinition == "" {
				return nil, fmt.Errorf("group %q rule[%d] %q: %w", group.Title, i, rule.UID, errMissingOriginalRule)
			}
			var promRule prom.PrometheusRule
			if err := yaml.Unmarshal([]byte(rule.Metadata.PrometheusStyleRule.OriginalRuleDefinition), &promRule); err != nil {
				return nil, fmt.Errorf("group %q rule[%d] %q: failed to parse original rule definition: %w", group.Title, i, rule.UID, err)
			}
			rules = append(rules, promRuleToEntry(promRule))
		}
		interval, err := prom_model.ParseDuration(fmt.Sprintf("%ds", group.Interval))
		if err != nil {
			return nil, fmt.Errorf("group %q: failed to parse interval: %w", group.Title, err)
		}
		intervalStr := model.PrometheusRulePromDuration(interval.String())
		specGroups = append(specGroups, model.PrometheusRulePrometheusRuleGroup{
			Name:     group.Title,
			Interval: &intervalStr,
			Rules:    rules,
		})
	}

	k8s := &model.PrometheusRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:      sourceName,
			UID:       types.UID(sourceName),
			Namespace: namespaceMapper(orgID),
			Labels:    make(map[string]string),
		},
		Spec: model.PrometheusRuleSpec{
			Groups: specGroups,
		},
	}

	meta, err := utils.MetaAccessor(k8s)
	if err != nil {
		return nil, fmt.Errorf("failed to get metadata accessor: %w", err)
	}
	meta.SetFolder(folderUID)
	if folderUID != "" {
		k8s.Labels[model.FolderLabelKey] = folderUID
	}

	if err := k8s.SetProvenanceStatus(string(provenance)); err != nil {
		return nil, fmt.Errorf("failed to set provenance status: %w", err)
	}
	return k8s, nil
}

func promRuleToEntry(r prom.PrometheusRule) model.PrometheusRulePrometheusRuleEntry {
	entry := model.PrometheusRulePrometheusRuleEntry{
		Expr:        r.Expr,
		Labels:      r.Labels,
		Annotations: r.Annotations,
	}
	if r.Alert != "" {
		a := r.Alert
		entry.Alert = &a
	}
	if r.Record != "" {
		rec := r.Record
		entry.Record = &rec
	}
	if r.For != nil {
		f := model.PrometheusRulePromDuration(r.For.String())
		entry.For = &f
	}
	if r.KeepFiringFor != nil {
		k := model.PrometheusRulePromDuration(r.KeepFiringFor.String())
		entry.KeepFiringFor = &k
	}
	// Strip the SourceLabelKey before returning so the round-tripped spec
	// doesn't expose internal tracking metadata. The label only lives on the
	// stored AlertRule.Labels, not on OriginalRuleDefinition.
	delete(entry.Labels, SourceLabelKey)
	return entry
}
