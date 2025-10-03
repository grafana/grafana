SELECT tm.id as id, t.uid as team_uid, t.id as team_id, u.uid as user_uid, tm.created, tm.updated, tm.permission
FROM {{ .Ident .TeamMemberTable }} tm
INNER JOIN {{ .Ident .TeamTable }} t ON tm.team_id = t.id
INNER JOIN {{ .Ident .UserTable }} u ON tm.user_id  = u.id
WHERE
  tm.org_id = {{ .Arg .Query.OrgID}}
  {{ if .Query.UID }}
    AND t.uid = {{ .Arg .Query.UID }}
  {{ end }}
  {{- if .Query.Pagination.Continue }}
    AND tm.id >= {{ .Arg .Query.Pagination.Continue }}
  {{- end }}
AND NOT tm.external
ORDER BY t.id ASC
LIMIT {{ .Arg .Query.Pagination.Limit }};
