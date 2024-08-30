SELECT t.id as team_id, t.uid as team_uid, t.name as team_name, tm.permission
FROM {{ .Ident .UserTable }} u
INNER JOIN {{ .Ident .TeamMemberTable }} tm on u.id = tm.user_id
INNER JOIN {{ .Ident .TeamTable }}t on tm.team_id = t.id
WHERE u.uid = {{ .Arg .Query.UserUID }}
AND t.org_id = {{ .Arg .Query.OrgID }}
{{- if .Query.Pagination.Continue }}
  AND t.id >= {{ .Arg .Query.Pagination.Continue }}
{{- end }}
ORDER BY t.id ASC
LIMIT {{ .Arg .Query.Pagination.Limit }};
