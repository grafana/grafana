package sortopts

import (
	"fmt"
	"sort"
	"strings"

	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/util/errutil"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

var (
	// SortOptionsByQueryParam is a map to translate the "sort" query param values to SortOption(s)
	SortOptionsByQueryParam = map[string]model.SortOption{
		"userAgent-asc":  newSortOption("user_agent", false, 0),
		"userAgent-desc": newSortOption("user_agent", true, 0),
		"updatedAt-asc":  newTimeSortOption("updated_at", false, 1),
		"updatedAt-desc": newTimeSortOption("updated_at", true, 2),
	}

	ErrorUnknownSortingOption = errutil.BadRequest("unknown sorting option")
)

type Sorter struct {
	Field         string
	LowerCase     bool
	Descending    bool
	WithTableName bool
}

func (s Sorter) OrderBy() string {
	orderBy := "anon_device."
	if !s.WithTableName {
		orderBy = ""
	}
	orderBy += s.Field
	if s.LowerCase {
		orderBy = fmt.Sprintf("LOWER(%v)", orderBy)
	}
	if s.Descending {
		return orderBy + " DESC"
	}
	return orderBy + " ASC"
}

func newSortOption(field string, desc bool, index int) model.SortOption {
	direction := "asc"
	description := ("A-Z")
	if desc {
		direction = "desc"
		description = ("Z-A")
	}
	return model.SortOption{
		Name:        fmt.Sprintf("%v-%v", field, direction),
		DisplayName: fmt.Sprintf("%v (%v)", cases.Title(language.Und).String(field), description),
		Description: fmt.Sprintf("Sort %v in an alphabetically %vending order", field, direction),
		Index:       index,
		Filter:      []model.SortOptionFilter{Sorter{Field: field, Descending: desc}},
	}
}

func newTimeSortOption(field string, desc bool, index int) model.SortOption {
	direction := "asc"
	description := ("Oldest-Newest")
	if desc {
		direction = "desc"
		description = ("Newest-Oldest")
	}
	return model.SortOption{
		Name:        fmt.Sprintf("%v-%v", field, direction),
		DisplayName: fmt.Sprintf("%v (%v)", cases.Title(language.Und).String(field), description),
		Description: fmt.Sprintf("Sort %v by time in an %vending order", field, direction),
		Index:       index,
		Filter:      []model.SortOptionFilter{Sorter{Field: field, Descending: desc}},
	}
}

// ParseSortQueryParam parses the "sort" query param and returns an ordered list of SortOption(s)
func ParseSortQueryParam(param string) ([]model.SortOption, error) {
	opts := []model.SortOption{}
	if param != "" {
		optsStr := strings.Split(param, ",")
		for i := range optsStr {
			if opt, ok := SortOptionsByQueryParam[optsStr[i]]; !ok {
				return nil, ErrorUnknownSortingOption.Errorf("%v option unknown", optsStr[i])
			} else {
				opts = append(opts, opt)
			}
		}
		sort.Slice(opts, func(i, j int) bool {
			return opts[i].Index < opts[j].Index || (opts[i].Index == opts[j].Index && opts[i].Name < opts[j].Name)
		})
	}
	return opts, nil
}
