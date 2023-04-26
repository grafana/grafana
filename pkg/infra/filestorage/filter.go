package filestorage

import (
	"strings"

	"github.com/armon/go-radix"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type treeValue string

const (
	treeValueDisallowedPath   treeValue = "!"
	treeValueDisallowedPrefix treeValue = "!*"
	treeValueAllowedPath      treeValue = ""
	treeValueAllowedPrefix    treeValue = "*"
)

type PathFilter interface {
	IsAllowed(path string) bool
	ToString() string

	asSQLFilter() accesscontrol.SQLFilter
}

// NewPathFilter factory function for a tree-based PathFilter
// `nil` and empty arrays are treated in a different way. The PathFilter will not perform checks associated with a `nil` array, examples:
//   - `allowedPrefixes` & `allowedPaths` are nil -> all paths are allowed (unless included in `disallowedX` arrays)
//   - `allowedPrefixes` & `allowedPaths` are both empty -> no paths are allowed, regardless of what is inside `disallowedX` arrays
//   - `allowedPrefixes` is nil, `allowedPaths` is not nil. -> only paths specified in `allowedPaths` are allowed (unless included in `disallowedX` arrays)
func NewPathFilter(allowedPrefixes []string, allowedPaths []string, disallowedPrefixes []string, disallowedPaths []string) PathFilter {
	if allowedPrefixes != nil && allowedPaths != nil && (len(allowedPrefixes)+len(allowedPaths) == 0) {
		return NewDenyAllPathFilter()
	}

	if allowedPaths == nil && allowedPrefixes == nil && (len(disallowedPaths)+len(disallowedPrefixes) == 0) {
		return NewAllowAllPathFilter()
	}

	return &radixTreePathFilter{
		tree: createRadixTree(toLower(allowedPrefixes), toLower(allowedPaths), toLower(disallowedPrefixes), toLower(disallowedPaths)),
	}
}

func NewAllowAllPathFilter() PathFilter {
	return &radixTreePathFilter{
		tree: createRadixTree([]string{Delimiter}, nil, nil, nil),
	}
}

func NewDenyAllPathFilter() PathFilter {
	return &radixTreePathFilter{
		tree: createRadixTree(nil, nil, []string{Delimiter}, nil),
	}
}

type radixTreePathFilter struct {
	tree *radix.Tree
}

func (r *radixTreePathFilter) asSQLFilter() accesscontrol.SQLFilter {
	denyConditions := make([]string, 0)
	denyArgs := make([]interface{}, 0)

	allowConditions := make([]string, 0)
	allowArgs := make([]interface{}, 0)

	r.tree.Walk(func(path string, v interface{}) bool {
		switch v.(treeValue) {
		case treeValueAllowedPrefix:
			allowConditions = append(allowConditions, "LOWER(PATH) LIKE ?")
			allowArgs = append(allowArgs, path+"%")
		case treeValueAllowedPath:
			allowConditions = append(allowConditions, "LOWER(PATH) = ?")
			allowArgs = append(allowArgs, path)
		case treeValueDisallowedPrefix:
			denyConditions = append(denyConditions, "LOWER(PATH) NOT LIKE ? ")
			denyArgs = append(denyArgs, path+"%")
		case treeValueDisallowedPath:
			denyConditions = append(denyConditions, "LOWER(PATH) != ?")
			denyArgs = append(denyArgs, path)
		}
		return false
	})

	if len(denyConditions)+len(allowConditions) == 0 {
		return accesscontrol.SQLFilter{Where: "1 = 1", Args: nil}
	}

	allowQuery := strings.Join(allowConditions, " OR ")
	denyQuery := strings.Join(denyConditions, " AND ")

	if len(allowConditions) == 0 {
		return accesscontrol.SQLFilter{
			Where: denyQuery,
			Args:  denyArgs,
		}
	}

	if len(denyConditions) == 0 {
		return accesscontrol.SQLFilter{
			Where: allowQuery,
			Args:  allowArgs,
		}
	}

	return accesscontrol.SQLFilter{
		Where: "(" + allowQuery + ") AND ( " + denyQuery + " )",
		Args:  append(allowArgs, denyArgs...),
	}
}

func (r *radixTreePathFilter) ToString() string {
	builder := strings.Builder{}
	r.tree.Walk(func(s string, v interface{}) bool {
		if builder.Len() != 0 {
			builder.WriteString("\n")
		}
		switch v.(treeValue) {
		case treeValueAllowedPrefix:
			builder.WriteString(s)
			builder.WriteString("*")
		case treeValueAllowedPath:
			builder.WriteString(s)
		case treeValueDisallowedPrefix:
			builder.WriteString("!")
			builder.WriteString(s)
			builder.WriteString("*")
		case treeValueDisallowedPath:
			builder.WriteString("!")
			builder.WriteString(s)
		}
		return false
	})
	return builder.String()
}

func (r *radixTreePathFilter) IsAllowed(path string) bool {
	path = strings.ToLower(path)

	allowed := false
	denied := false
	r.tree.WalkPath(path, func(s string, v interface{}) bool {
		if v == treeValueDisallowedPrefix || (s == path && v == treeValueDisallowedPath) {
			denied = true
			return true
		}

		if v == treeValueAllowedPrefix || (s == path && v == treeValueAllowedPath) {
			allowed = true
			// have to keep traversing to look for explicit denies
		}
		return false
	})

	if denied {
		return false
	}

	return allowed
}

func createRadixTree(allowedPrefixes []string, allowedPaths []string, disallowedPrefixes []string, disallowedPaths []string) *radix.Tree {
	tree := radix.New()
	for _, disallowedPrefix := range disallowedPrefixes {
		tree.Insert(disallowedPrefix, treeValueDisallowedPrefix)
	}

	for _, disallowedPath := range disallowedPaths {
		tree.Insert(disallowedPath, treeValueDisallowedPath)
	}

	for _, allowedPath := range allowedPaths {
		isDenied := false
		tree.WalkPath(allowedPath, func(s string, v interface{}) bool {
			if v == treeValueDisallowedPrefix || s == allowedPath {
				isDenied = true
				return true
			}
			return false
		})

		if !isDenied {
			tree.Insert(allowedPath, treeValueAllowedPath)
		}
	}

	for _, allowedPrefix := range allowedPrefixes {
		isDenied := false
		tree.WalkPath(allowedPrefix, func(s string, v interface{}) bool {
			if v == treeValueDisallowedPrefix {
				isDenied = true
				return true
			}
			return false
		})

		if !isDenied {
			tree.Insert(allowedPrefix, treeValueAllowedPrefix)
		}
	}

	return tree
}

type allOfPathFilter struct {
	filters []PathFilter
}

func (m allOfPathFilter) IsAllowed(path string) bool {
	for _, filter := range m.filters {
		isAllowed := filter.IsAllowed(path)
		if !isAllowed {
			return false
		}
	}
	return true
}

func (m allOfPathFilter) ToString() string {
	s := strings.Builder{}
	for _, filter := range m.filters {
		if s.Len() != 0 {
			s.WriteString("\n\nAND\n")
		}
		s.WriteString(filter.ToString())
	}
	return s.String()
}

func (m allOfPathFilter) asSQLFilter() accesscontrol.SQLFilter {
	queries := make([]string, 0)

	args := make([]interface{}, 0)
	for _, filter := range m.filters {
		sqlFilter := filter.asSQLFilter()
		queries = append(queries, "("+sqlFilter.Where+")")
		args = append(args, sqlFilter.Args...)
	}

	return accesscontrol.SQLFilter{
		Where: "(" + strings.Join(queries, " AND ") + ")",
		Args:  args,
	}
}

func NewAndPathFilter(filters ...PathFilter) PathFilter {
	return &allOfPathFilter{filters: filters}
}
