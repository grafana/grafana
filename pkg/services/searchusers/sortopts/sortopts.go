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
	// FIXME: SortOptions have to be customized based on the table name "user" or alias "u"
	//        It would be nice to align SQL search functions to use one or the other.
	SortOptionsByQueryParam = map[string]func(table string) model.SortOption{
		"login-asc":          newSortOption("login", false, 0),
		"login-desc":         newSortOption("login", true, 0),
		"email-asc":          newSortOption("email", false, 1),
		"email-desc":         newSortOption("email", true, 1),
		"name-asc":           newSortOption("name", false, 2),
		"name-desc":          newSortOption("name", true, 2),
		"lastSeenAtAge-asc":  newSortOption("last_seen_at", false, 3),
		"lastSeenAtAge-desc": newSortOption("last_seen_at", true, 3),
	}

	ErrorUnknownSortingOption = errutil.BadRequest("unknown sorting option")
)

type Sorter struct {
	Field      string
	Descending bool
	Table      string
}

func (s Sorter) OrderBy() string {
	if s.Descending {
		return fmt.Sprintf("%v.%v DESC", s.Table, s.Field)
	}

	return fmt.Sprintf("%v.%v ASC", s.Table, s.Field)
}

func newSortOption(field string, desc bool, index int) func(table string) model.SortOption {
	direction := "asc"
	alpha := ("A-Z")
	if desc {
		direction = "desc"
		alpha = ("Z-A")
	}
	return func(table string) model.SortOption {
		return model.SortOption{
			Name:        fmt.Sprintf("%v-%v", field, direction),
			DisplayName: fmt.Sprintf("%v (%v)", cases.Title(language.Und).String(field), alpha),
			Description: fmt.Sprintf("Sort %v in an alphabetically %vending order", field, direction),
			Index:       index,
			Filter:      []model.SortOptionFilter{Sorter{Table: table, Field: field, Descending: desc}},
		}
	}
}

func ParseSortQueryParamUserTableName(param string) ([]model.SortOption, error) {
	return ParseSortQueryParam("user", param)
}

func ParseSortQueryParamUserTableAlias(param string) ([]model.SortOption, error) {
	return ParseSortQueryParam("u", param)
}

// ParseSortQueryParam parses the "sort" query param and returns an ordered list of SortOption(s)
// FIXME: SortOptions have to be customized based on the table name "user" or alias "u"
// It would be nice to align SQL search functions to use one or the other.
func ParseSortQueryParam(table, param string) ([]model.SortOption, error) {
	opts := []model.SortOption{}
	if param != "" {
		optsStr := strings.Split(param, ",")
		for i := range optsStr {
			if opt, ok := SortOptionsByQueryParam[optsStr[i]]; !ok {
				return nil, ErrorUnknownSortingOption.Errorf("%v option unknown", optsStr[i])
			} else {
				opts = append(opts, opt(table))
			}
		}
		sort.Slice(opts, func(i, j int) bool {
			return opts[i].Index < opts[j].Index || (opts[i].Index == opts[j].Index && opts[i].Name < opts[j].Name)
		})
	}
	return opts, nil
}
