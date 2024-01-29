package database

//
// This file is an almost-independent alternative search query implementation.
// If that goes well - we can move it into a standalone package.  For now it's
// part of dashboards since we need to track internal details such as results
// and timing from both searches, so rather than exposing these internal details
// we use them from within the same package.  Once the results are stable and
// the timings are good - we move this out.
//
// Btw, template-base search query builder is completely independent and if
// there is a need for one in any other package - feel free to move it outside
// into pkg/util et al.
//

import (
	"context"
	"strings"
	"text/template"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// searchData is an input data for the search query template below.
type searchData struct {
	SQLBuilder
	Text    string
	OrgID   int64
	UserID  int64
	TeamIDs []int64
	Role    string
	Limit   int64

	Dialect        migrator.Dialect
	HasSplitScopes bool
}

// SQLBuilder is a more-or-less reusable SQL query builder that is based on
// text/template. SQL is not a composable language really, so having all
// subqueries/partials/filters in one place helps to better understand the whole
// query.
// SQLBuilder is expected to be embedded into the data struct passed into the
// template. In a template one can use {{.Arg .Foo}} and it will replace that
// with a "?" placeholder appending the value of .Foo to the Params slice.
type SQLBuilder struct {
	Params []any
}

func (sb *SQLBuilder) Arg(v any) (sql string) { sb.Params = append(sb.Params, v); return "?" }

var searchSQL = template.Must(template.New("").Parse(`
{{- /*
####
#### Here come different implementations for the innermost full-text search query.
#### A query is expected to return a list of entities with their (OrgID, UID, Kind, Title, ParentFolderUID)
####
*/ -}}
{{- define "text-search" -}}
SELECT org_id, 'dashboard' as kind, uid, id, folder_uid as parent_uid, title FROM dashboard WHERE title {{ .Dialect.LikeStr }} {{ .Arg .Text }} AND NOT is_folder
UNION ALL
SELECT org_id, 'folder' as kind, uid, 0, parent_uid, title FROM folder WHERE title {{ .Dialect.LikeStr }} {{ .Arg .Text }}
{{ end }}
{{- define "text-search-mysql-fts" -}}
SELECT org_id, 'dashboard' as kind, uid, id, folder_uid as parent_uid, title FROM dashboard WHERE MATCH(title) AGAINST({{ .Arg .Text }}) AND NOT is_folder
UNION ALL
SELECT org_id, 'folder' as kind, uid, 0, parent_uid, title FROM folder WHERE MATCH(title) AGAINST({{ .Arg .Text }})
{{ end }}
{{- define "text-search-legacy" -}}
SELECT org_id, CASE WHEN is_folder THEN 'folder' ELSE 'dashboard' END as kind, uid, id, folder_uid as parent_uid, title FROM dashboard WHERE title {{ .Dialect.LikeStr }} {{ .Arg .Text }} AND NOT is_folder
{{ end }}

SELECT org_id, kind, uid, entity.id, title, dashboard_tag.term as term, folder_uid, folder_title FROM (
	SELECT DISTINCT
		entity.org_id, entity.kind, entity.uid, entity.id, entity.title, f1.uid as folder_uid, f1.title as folder_title FROM (
		{{- template "text-search-legacy" . -}}
	) AS entity
	LEFT JOIN folder f1 ON (entity.parent_uid = f1.uid AND entity.org_id = f1.org_id)
	{{ if ne .UserID 0 }}   {{- /* If a user is not admin: need to filter by permissions */ -}}
	LEFT JOIN folder f2 ON (f1.parent_uid     = f2.uid AND f1.org_id     = f2.org_id)
	LEFT JOIN folder f3 ON (f2.parent_uid     = f3.uid AND f2.org_id     = f3.org_id)
	LEFT JOIN folder f4 ON (f3.parent_uid     = f4.uid AND f3.org_id     = f4.org_id)
	INNER JOIN permission p ON 
	p.role_id IN (
		SELECT ur.role_id FROM user_role AS ur    WHERE ur.user_id = {{ .Arg .UserID }} AND (ur.org_id = {{ .Arg .OrgID }} OR ur.org_id = 0)
		{{ if .TeamIDs }}
		UNION
		SELECT tr.role_id FROM team_role AS tr    WHERE tr.team_id IN (
			{{- range $i, $el := .TeamIDs -}}
			{{- if $i -}},{{- end -}}
			{{- $.Arg $el -}}
			{{- end -}}
		) AND tr.org_id = {{ .Arg .OrgID }}
		{{ end }}
		UNION
		SELECT br.role_id FROM builtin_role AS br WHERE br.role IN ({{ .Arg .Role }}) AND (br.org_id = {{ .Arg .OrgID }} OR br.org_id = 0)
	) AND (
		{{- /* This permission check relies on the optimised (indexed) split scope columns in the permission table */ -}}
		(
			p.kind = 'dashboards' AND
			p.action = 'dashboards:read' AND
			p.identifier IN (entity.uid, f4.uid, f3.uid, f2.uid, f1.uid)
		) OR (
			p.kind = 'folders' AND
			p.action = 'folders:read' AND
			p.identifier IN (f4.uid, f3.uid, f2.uid, f1.uid, entity.uid)
		)
	)
	{{ end }}
	ORDER BY entity.title ASC
	LIMIT {{ .Arg .Limit }}
) AS entity
LEFT JOIN dashboard_tag ON dashboard_tag.dashboard_id = entity.id
`))

func (d *dashboardStore) altSearch(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	// Only handle non-empty search queries
	if query.Title == "" {
		return nil, nil
	}

	// Get OrgID, Team IDs and UserID (zero for admins)
	orgID, userID, teamIDs := query.OrgId, int64(0), []int64{}
	if orgID == 0 {
		orgID = query.SignedInUser.GetOrgID()
	}
	if !query.SignedInUser.GetIsGrafanaAdmin() {
		namespaceID, identifier := query.SignedInUser.GetNamespacedID()
		switch namespaceID {
		case identity.NamespaceUser, identity.NamespaceServiceAccount:
			userID, _ = identity.IntIdentifier(namespaceID, identifier)
		}
		teamIDs = query.SignedInUser.GetTeams()

		// TODO: check wildcard dashboard and folder scopes?
		// TODO: self-contained permissions?
	}

	// Handle limits and pagination
	// TODO: pagination
	limit := query.Limit
	if limit < 1 {
		limit = 1000
	} else if limit > 5000 {
		limit = 5000
	}

	data := &searchData{
		Text:    "%" + query.Title + "%", // TODO: sanitize input?
		OrgID:   orgID,
		UserID:  userID,
		TeamIDs: teamIDs,
		Role:    "Viewer",
		Limit:   limit,

		Dialect:        d.store.GetDialect(),
		HasSplitScopes: d.features.IsEnabled(ctx, featuremgmt.FlagSplitScopes),
	}

	sql := &strings.Builder{}
	if err := searchSQL.Execute(sql, data); err != nil {
		return nil, err
	}

	hits := []searchHit{}
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL(sql.String(), data.Params...).Find(&hits)
	})

	results := make([]dashboards.DashboardSearchProjection, len(hits))
	for i, hit := range hits {
		d.log.Debug("Alternative search hit", "org_id", hit.OrgID, "kind", hit.Kind, "uid", hit.UID, "title", hit.Title, "folder_uid", hit.FolderUID, "folder", hit.FolderTitle, "term", hit.Term)
		results[i] = dashboards.DashboardSearchProjection{
			ID:          hit.ID,
			UID:         hit.UID,
			Title:       hit.Title,
			Term:        hit.Term,
			IsFolder:    hit.Kind == "folder",
			FolderUID:   hit.FolderUID,
			FolderTitle: hit.FolderTitle,
		}
	}

	return results, err
}

func (d *dashboardStore) altSearhLogResultDiff(results, expected []dashboards.DashboardSearchProjection) {
	expectedUIDs, resultUIDs, n, m := map[string]struct{}{}, map[string]struct{}{}, 0, 0
	for _, hit := range expected {
		expectedUIDs[hit.UID] = struct{}{}
	}
	for _, hit := range results {
		resultUIDs[hit.UID] = struct{}{}
		if _, ok := expectedUIDs[hit.UID]; !ok {
			d.log.Info("Alternative search query mismatch", "unexpected", hit.Title, "uid", hit.UID)
			n++
		}
	}
	for _, hit := range expected {
		if _, ok := resultUIDs[hit.UID]; !ok {
			d.log.Info("Alternative search query mismatch", "missed", hit.Title, "uid", hit.UID)
			m++
		}
	}
	if n+m > 0 {
		d.log.Info("Alternative search query got different results", "matched", (len(expected)+len(results)-n-m)/2, "unexpected", n, "missed", m)
	}
}
