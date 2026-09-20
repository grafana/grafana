package search

import (
	"strings"

	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func ruleTypeForResource(req *resourcepb.ResourceSearchRequest) string {
	if req.Options.GetKey().GetResource() == recordingrule.ResourceInfo.GroupResource().Resource {
		return ruleTypeRecording
	}
	return ruleTypeAlerting
}

func emptyResponse() *resourcepb.ResourceSearchResponse {
	return &resourcepb.ResourceSearchResponse{
		Results:        &resourcepb.ResourceTable{Columns: resultColumnDefinitions()},
		TotalHitsExact: true,
	}
}

func matchSourceDatasourceUIDs(r *ngmodels.AlertRule, wanted []string) bool {
	if len(wanted) == 0 {
		return true
	}
	available := make(map[string]struct{})
	for _, uid := range sourceDatasourceUIDs(r) {
		available[uid] = struct{}{}
	}
	for _, uid := range wanted {
		if _, ok := available[uid]; ok {
			return true
		}
	}
	return false
}

func matchTitle(r *ngmodels.AlertRule, query string) bool {
	title := strings.ToLower(r.Title)
	for _, term := range titleSearchTerms(query) {
		if !strings.Contains(title, term) {
			return false
		}
	}
	return true
}

func titleSearchTerms(query string) []string {
	const minTermBytes = 3
	words := strings.Fields(strings.ToLower(query))
	terms := make([]string, 0, len(words))
	for _, word := range words {
		if len(word) >= minTermBytes {
			terms = append(terms, word)
		}
	}
	if len(terms) == 0 {
		return words
	}
	return terms
}
