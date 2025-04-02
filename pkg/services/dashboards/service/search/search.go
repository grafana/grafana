package dashboardsearch

import (
	"encoding/binary"
	"encoding/json"
	"fmt"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	excludedFields = map[string]string{
		resource.SEARCH_FIELD_EXPLAIN: "",
		resource.SEARCH_FIELD_SCORE:   "",
		resource.SEARCH_FIELD_TITLE:   "",
		resource.SEARCH_FIELD_FOLDER:  "",
		resource.SEARCH_FIELD_TAGS:    "",
	}

	IncludeFields = []string{
		resource.SEARCH_FIELD_TITLE,
		resource.SEARCH_FIELD_TAGS,
		resource.SEARCH_FIELD_LABELS,
		resource.SEARCH_FIELD_FOLDER,
		resource.SEARCH_FIELD_CREATED,
		resource.SEARCH_FIELD_CREATED_BY,
		resource.SEARCH_FIELD_UPDATED,
		resource.SEARCH_FIELD_UPDATED_BY,
		resource.SEARCH_FIELD_MANAGER_KIND,
		resource.SEARCH_FIELD_MANAGER_ID,
		resource.SEARCH_FIELD_SOURCE_PATH,
		resource.SEARCH_FIELD_SOURCE_CHECKSUM,
		resource.SEARCH_FIELD_SOURCE_TIME,
	}
)

func ParseResults(result *resource.ResourceSearchResponse, offset int64) (v0alpha1.SearchResults, error) {
	if result == nil {
		return v0alpha1.SearchResults{}, nil
	} else if result.Error != nil {
		return v0alpha1.SearchResults{}, fmt.Errorf("%d error searching: %s: %s", result.Error.Code, result.Error.Message, result.Error.Details)
	} else if result.Results == nil {
		return v0alpha1.SearchResults{}, nil
	}

	titleIDX := -1
	folderIDX := -1
	tagsIDX := -1
	scoreIDX := -1
	explainIDX := -1

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

		fields := &common.Unstructured{}
		for colIndex, col := range result.Results.Columns {
			if _, ok := excludedFields[col.Name]; !ok {
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
		if tagsIDX >= 0 && row.Cells[tagsIDX] != nil {
			_ = json.Unmarshal(row.Cells[tagsIDX], &hit.Tags)
		}
		if explainIDX >= 0 && row.Cells[explainIDX] != nil {
			_ = json.Unmarshal(row.Cells[explainIDX], &hit.Explain)
		}
		if scoreIDX >= 0 && row.Cells[scoreIDX] != nil {
			_, _ = binary.Decode(row.Cells[scoreIDX], binary.BigEndian, &hit.Score)
		}

		sr.Hits[i] = *hit
	}

	// Add facet results
	if result.Facet != nil {
		sr.Facets = make(map[string]v0alpha1.FacetResult)
		for k, v := range result.Facet {
			sr.Facets[k] = v0alpha1.FacetResult{
				Field:   v.Field,
				Total:   v.Total,
				Missing: v.Missing,
				Terms:   make([]v0alpha1.TermFacet, len(v.Terms)),
			}
			for j, t := range v.Terms {
				sr.Facets[k].Terms[j] = v0alpha1.TermFacet{
					Term:  t.Term,
					Count: t.Count,
				}
			}
		}
	}

	return sr, nil
}
