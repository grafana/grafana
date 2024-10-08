SELECT tm.id as id, t.uid as team_uid, t.id as team_id, u.uid as user_uid, tm.created, tm.updated, tm.permission
FROM {{ .Ident .TeamMemberTable }} tm
INNER JOIN {{ .Ident .TeamTable }} t ON tm.team_id = t.id
INNER JOIN {{ .Ident .UserTable }} u ON tm.user_id  = u.id
WHERE
{{ if .Query.UID }}
    t.uid = {{ .Arg .Query.UID }}
{{ else }}
    t.uid IN(
      SELECT uid
      FROM {{ .Ident .TeamTable }} t
      {{ if .Query.Pagination.Continue }}
        WHERE t.id >= {{ .Arg .Query.Pagination.Continue }}
      {{ end }}
      ORDER BY t.id ASC LIMIT {{ .Arg .Query.Pagination.Limit }}
    )
{{ end }}
AND tm.org_id = {{ .Arg .Query.OrgID}}
AND NOT tm.external
ORDER BY t.id ASC;
