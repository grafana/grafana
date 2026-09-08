package dashboardsearch

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	// These fields exist at the top-level of DashboardHit
	standardFields = map[string]string{
		resource.SEARCH_FIELD_EXPLAIN:          "",
		resource.SEARCH_FIELD_SCORE:            "",
		resource.SEARCH_FIELD_TITLE:            "",
		resource.SEARCH_FIELD_FOLDER:           "",
		resource.SEARCH_FIELD_TAGS:             "",
		resource.SEARCH_FIELD_DESCRIPTION:      "",
		resource.SEARCH_FIELD_MANAGER_ID:       "",
		resource.SEARCH_FIELD_MANAGER_KIND:     "",
		resource.SEARCH_FIELD_OWNER_REFERENCES: "",
	}

	IncludeFields = []string{
		resource.SEARCH_FIELD_TITLE,
		resource.SEARCH_FIELD_TAGS,
		resource.SEARCH_FIELD_LABELS,
		resource.SEARCH_FIELD_FOLDER,
		resource.SEARCH_FIELD_DESCRIPTION,
		resource.SEARCH_FIELD_CREATED,
		resource.SEARCH_FIELD_CREATED_BY,
		resource.SEARCH_FIELD_UPDATED,
		resource.SEARCH_FIELD_UPDATED_BY,
		resource.SEARCH_FIELD_MANAGER_KIND,
		resource.SEARCH_FIELD_MANAGER_ID,
		resource.SEARCH_FIELD_SOURCE_PATH,
		resource.SEARCH_FIELD_SOURCE_CHECKSUM,
		resource.SEARCH_FIELD_SOURCE_TIME,
		resource.SEARCH_FIELD_OWNER_REFERENCES,
		// below is needed to determine whether a provisioned dashboard exists or not
		resource.SEARCH_FIELD_LEGACY_ID,
		resource.SEARCH_FIELD_LABELS + "." + resource.SEARCH_FIELD_LEGACY_ID,
	}
)

type SearchFunc func(ctx context.Context, orgID int64, request *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error)

// SearchAll executes a search request and paginates through all results by incrementing the offset until the offset is greater than total hits
// or it hits an empty page.
func SearchAll(ctx context.Context, orgID int64, request *resourcepb.ResourceSearchRequest, searchFn SearchFunc) (v0alpha1.SearchResults, error) {
	if request.Limit == 0 {
		request.Limit = 100000
	}
	request.Page = int64(1)
	request.Offset = int64(0)

	res, err := searchFn(ctx, orgID, request)
	if err != nil {
		return v0alpha1.SearchResults{}, err
	}
	results, err := ParseResults(res, 0)
	if err != nil {
		return v0alpha1.SearchResults{}, err
	}

	request.Offset += int64(len(results.Hits))
	request.Page++
	for request.Offset < res.TotalHits {
		res, err = searchFn(ctx, orgID, request)
		if err != nil {
			return v0alpha1.SearchResults{}, err
		}

		page, err := ParseResults(res, 0)
		if err != nil {
			return v0alpha1.SearchResults{}, err
		}

		if len(page.Hits) == 0 {
			break
		}

		results.Hits = append(results.Hits, page.Hits...)
		request.Offset += int64(len(page.Hits))
		request.Page++
	}

	return results, nil
}

func ParseResults(result *resourcepb.ResourceSearchResponse, offset int64) (v0alpha1.SearchResults, error) {
	if result == nil {
		return v0alpha1.SearchResults{}, nil
	} else if result.Error != nil {
		// Wrap via GetError so the status code/reason survives, letting callers
		// classify transient search failures (e.g. 429/503) as retryable.
		return v0alpha1.SearchResults{}, fmt.Errorf("error searching: %w", resource.GetError(result.Error))
	}

	switch result.ResultFormat {
	case resourcepb.ResourceSearchRequest_UNSPECIFIED, resourcepb.ResourceSearchRequest_RESOURCE_TABLE:
		return parseTableResults(result, offset)
	case resourcepb.ResourceSearchRequest_FIELD_VALUES:
		return parseFieldValueResults(result, offset)
	default:
		return v0alpha1.SearchResults{}, fmt.Errorf("unsupported search result format %d", result.ResultFormat)
	}
}

// nolint:gocyclo
func parseTableResults(result *resourcepb.ResourceSearchResponse, offset int64) (v0alpha1.SearchResults, error) {
	if result.Results == nil {
		return v0alpha1.SearchResults{}, nil
	}

	titleIDX := -1
	folderIDX := -1
	tagsIDX := -1
	descriptionIDX := -1
	scoreIDX := -1
	explainIDX := -1
	managerKindIDX := -1
	managerIdIDX := -1
	ownerRefsIDX := -1

	for i, v := range result.Results.Columns {
		switch v.Name {
		case resource.SEARCH_FIELD_EXPLAIN:
			explainIDX = i
		case resource.SEARCH_FIELD_SCORE:
			scoreIDX = i
		case resource.SEARCH_FIELD_TITLE:
			titleIDX = i
		case resource.SEARCH_FIELD_FOLDER:
			folderIDX = i
		case resource.SEARCH_FIELD_TAGS:
			tagsIDX = i
		case resource.SEARCH_FIELD_MANAGER_ID:
			managerIdIDX = i
		case resource.SEARCH_FIELD_MANAGER_KIND:
			managerKindIDX = i
		case resource.SEARCH_FIELD_DESCRIPTION:
			descriptionIDX = i
		case resource.SEARCH_FIELD_OWNER_REFERENCES:
			ownerRefsIDX = i
		}
	}

	sr := v0alpha1.SearchResults{
		Offset:    offset,
		TotalHits: result.TotalHits,
		QueryCost: result.QueryCost,
		MaxScore:  result.MaxScore,
		Hits:      make([]v0alpha1.DashboardHit, len(result.Results.Rows)),
	}

	for i, row := range result.Results.Rows {
		if len(row.Cells) != len(result.Results.Columns) {
			// there should never be mismatch len between # Columns and # Cells in a row. This indicates a bug in our
			// code
			return v0alpha1.SearchResults{}, fmt.Errorf("error parsing Search Response: mismatch number of columns and cells")
		}

		// Dynamically defined fields
		fields := &common.Unstructured{}
		for colIndex, col := range result.Results.Columns {
			if _, ok := standardFields[col.Name]; !ok {
				val, err := resource.DecodeCell(col, colIndex, row.Cells[colIndex])
				if err != nil {
					return v0alpha1.SearchResults{}, err
				}
				// Some of the dashboard fields come in as int32, but we need to convert them to int64 or else fields.Set() will panic
				int32Val, ok := val.(int32)
				if ok {
					val = int64(int32Val)
				}
				fields.Set(col.Name, val)
			}
		}

		hit := &v0alpha1.DashboardHit{
			Resource: row.Key.Resource, // folders | dashboards
			Name:     row.Key.Name,     // The Grafana UID
			Field:    fields,
		}
		if titleIDX >= 0 && row.Cells[titleIDX] != nil {
			hit.Title = string(row.Cells[titleIDX])
		} else {
			hit.Title = "(no title)"
		}

		if folderIDX >= 0 && row.Cells[folderIDX] != nil {
			hit.Folder = string(row.Cells[folderIDX])
		}
		if descriptionIDX >= 0 && row.Cells[descriptionIDX] != nil {
			hit.Description = string(row.Cells[descriptionIDX])
		}
		if managerIdIDX >= 0 && row.Cells[managerIdIDX] != nil {
			hit.ManagedBy.ID = string(row.Cells[managerIdIDX])
		}
		if managerKindIDX >= 0 && row.Cells[managerKindIDX] != nil {
			hit.ManagedBy.Kind = utils.ManagerKind(row.Cells[managerKindIDX])
		}
		if tagsIDX >= 0 && row.Cells[tagsIDX] != nil {
			_ = json.Unmarshal(row.Cells[tagsIDX], &hit.Tags)
		}
		if explainIDX >= 0 && row.Cells[explainIDX] != nil {
			_ = json.Unmarshal(row.Cells[explainIDX], &hit.Explain)
		}
		if scoreIDX >= 0 && row.Cells[scoreIDX] != nil {
			_, _ = binary.Decode(row.Cells[scoreIDX], binary.BigEndian, &hit.Score)
		}
		if ownerRefsIDX >= 0 && row.Cells[ownerRefsIDX] != nil {
			_ = json.Unmarshal(row.Cells[ownerRefsIDX], &hit.OwnerReferences)
		}

		sr.Hits[i] = *hit
	}

	sr.Facets = parseFacets(result.Facet)
	return sr, nil
}

func parseFieldValueResults(result *resourcepb.ResourceSearchResponse, offset int64) (v0alpha1.SearchResults, error) {
	sr := v0alpha1.SearchResults{
		Offset:    offset,
		TotalHits: result.TotalHits,
		QueryCost: result.QueryCost,
		MaxScore:  result.MaxScore,
		Hits:      make([]v0alpha1.DashboardHit, len(result.Rows)),
	}

	for i, row := range result.Rows {
		if row == nil || row.Key == nil {
			return v0alpha1.SearchResults{}, fmt.Errorf("field-value search result row %d has no resource key", i)
		}
		values, err := resource.DecodeSearchValues(result.Fields, row)
		if err != nil {
			return v0alpha1.SearchResults{}, fmt.Errorf("decoding field-value search result row %d: %w", i, err)
		}

		fields := &common.Unstructured{}
		for name, value := range values {
			if _, ok := standardFields[name]; !ok {
				fields.Set(name, jsonCompatibleValue(value))
			}
		}

		hit := &v0alpha1.DashboardHit{
			Resource: row.Key.Resource,
			Name:     row.Key.Name,
			Field:    fields,
		}
		if title, ok := values[resource.SEARCH_FIELD_TITLE].(string); ok {
			hit.Title = title
		} else {
			hit.Title = "(no title)"
		}
		// The declarations determine these types; comma-ok keeps mixed-version responses from panicking.
		hit.Folder, _ = values[resource.SEARCH_FIELD_FOLDER].(string)
		hit.Description, _ = values[resource.SEARCH_FIELD_DESCRIPTION].(string)
		hit.Tags, _ = values[resource.SEARCH_FIELD_TAGS].([]string)
		hit.ManagedBy.ID, _ = values[resource.SEARCH_FIELD_MANAGER_ID].(string)
		if managerKind, ok := values[resource.SEARCH_FIELD_MANAGER_KIND].(string); ok {
			hit.ManagedBy.Kind = utils.ManagerKind(managerKind)
		}
		hit.OwnerReferences, _ = values[resource.SEARCH_FIELD_OWNER_REFERENCES].([]string)
		if row.Score != nil {
			hit.Score = row.GetScore()
		}
		sr.Hits[i] = *hit
	}

	sr.Facets = parseFacets(result.Facet)
	return sr, nil
}

func parseFacets(facets map[string]*resourcepb.ResourceSearchResponse_Facet) map[string]v0alpha1.FacetResult {
	if facets == nil {
		return nil
	}
	out := make(map[string]v0alpha1.FacetResult, len(facets))
	for name, facet := range facets {
		out[name] = v0alpha1.FacetResult{
			Field:   facet.Field,
			Total:   facet.Total,
			Missing: facet.Missing,
			Terms:   make([]v0alpha1.TermFacet, len(facet.Terms)),
		}
		for i, term := range facet.Terms {
			out[name].Terms[i] = v0alpha1.TermFacet{Term: term.Term, Count: term.Count}
		}
	}
	return out
}

func jsonCompatibleValue(value any) any {
	switch values := value.(type) {
	case []string:
		return sliceToAny(values)
	case []int64:
		return sliceToAny(values)
	case []float64:
		return sliceToAny(values)
	case []bool:
		return sliceToAny(values)
	default:
		return value
	}
}

func sliceToAny[T any](values []T) []any {
	out := make([]any, len(values))
	for i, value := range values {
		out[i] = value
	}
	return out
}
