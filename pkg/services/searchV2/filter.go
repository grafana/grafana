package searchV2

import (
	"regexp"
	"strings"

	"github.com/blugelabs/bluge"
	"github.com/blugelabs/bluge/search"
	"github.com/blugelabs/bluge/search/searcher"
	"github.com/blugelabs/bluge/search/similarity"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/store/entity"
)

type PermissionFilter struct {
	log    log.Logger
	filter ResourceFilter
}

type entityKind string

const (
	entityKindPanel      entityKind = entity.StandardKindPanel
	entityKindDashboard  entityKind = entity.StandardKindDashboard
	entityKindFolder     entityKind = entity.StandardKindFolder
	entityKindDatasource entityKind = entity.StandardKindDataSource
	entityKindQuery      entityKind = entity.StandardKindQuery
)

func (r entityKind) IsValid() bool {
	return r == entityKindPanel || r == entityKindDashboard || r == entityKindFolder
}

func (r entityKind) supportsAuthzCheck() bool {
	return r == entityKindPanel || r == entityKindDashboard || r == entityKindFolder
}

var (
	permissionFilterFields                 = []string{documentFieldUID, documentFieldKind, documentFieldLocation}
	panelIdFieldRegex                      = regexp.MustCompile(`^(.*)#([0-9]{1,4})$`)
	panelIdFieldDashboardUidSubmatchIndex  = 1
	panelIdFieldPanelIdSubmatchIndex       = 2
	panelIdFieldRegexExpectedSubmatchCount = 3 // submatches[0] - whole string

	_ bluge.Query = (*PermissionFilter)(nil)
)

func newPermissionFilter(resourceFilter ResourceFilter, log log.Logger) *PermissionFilter {
	return &PermissionFilter{
		filter: resourceFilter,
		log:    log,
	}
}

func (q *PermissionFilter) logAccessDecision(decision bool, kind any, id string, reason string, ctx ...any) {
	if true {
		return // TOO much logging right now
	}

	ctx = append(ctx, "kind", kind, "id", id, "reason", reason)
	if decision {
		q.log.Debug("Allowing access", ctx...)
	} else {
		q.log.Info("Denying access", ctx...)
	}
}

func (q *PermissionFilter) canAccess(kind entityKind, id, location string) bool {
	if !kind.supportsAuthzCheck() {
		q.logAccessDecision(false, kind, id, "entityDoesNotSupportAuthz")
		return false
	}

	// TODO add `kind` to the `ResourceFilter` interface so that we can move the switch out of here
	//
	switch kind {
	case entityKindFolder, entityKindDashboard:
		decision := q.filter(kind, id, location)
		q.logAccessDecision(decision, kind, id, "resourceFilter")
		return decision
	case entityKindPanel:
		matches := panelIdFieldRegex.FindStringSubmatch(id)
		submatchCount := len(matches)
		if submatchCount != panelIdFieldRegexExpectedSubmatchCount {
			q.logAccessDecision(false, kind, id, "invalidPanelIdFieldRegexSubmatchCount", "submatchCount", submatchCount, "expectedSubmatchCount", panelIdFieldRegexExpectedSubmatchCount)
			return false
		}
		dashboardUid := matches[panelIdFieldDashboardUidSubmatchIndex]

		// Location is <folder_uid>/<dashboard_uid>
		if !strings.HasSuffix(location, "/"+dashboardUid) {
			q.logAccessDecision(false, kind, id, "invalidLocation", "location", location, "dashboardUid", dashboardUid)
			return false
		}
		folderUid := location[:len(location)-len(dashboardUid)-1]

		decision := q.filter(entityKindDashboard, dashboardUid, folderUid)
		q.logAccessDecision(decision, kind, id, "resourceFilter", "folderUid", folderUid, "dashboardUid", dashboardUid, "panelId", matches[panelIdFieldPanelIdSubmatchIndex])
		return decision
	default:
		q.logAccessDecision(false, kind, id, "reason", "unknownKind")
		return false
	}
}

func (q *PermissionFilter) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	dvReader, err := i.DocumentValueReader(permissionFilterFields)
	if err != nil {
		return nil, err
	}

	s, err := searcher.NewMatchAllSearcher(i, 1, similarity.ConstantScorer(1), options)
	if err != nil {
		return nil, err
	}
	return searcher.NewFilteringSearcher(s, func(d *search.DocumentMatch) bool {
		var kind, id, location string
		err := dvReader.VisitDocumentValues(d.Number, func(field string, term []byte) {
			switch field {
			case documentFieldKind:
				kind = string(term)
			case documentFieldUID:
				id = string(term)
			case documentFieldLocation:
				location = string(term)
			}
		})
		if err != nil {
			q.logAccessDecision(false, kind, id, "errorWhenVisitingDocumentValues")
			return false
		}

		e := entityKind(kind)
		if !e.IsValid() {
			q.logAccessDecision(false, kind, id, "invalidEntityKind")
			return false
		}

		return q.canAccess(e, id, location)
	}), err
}
