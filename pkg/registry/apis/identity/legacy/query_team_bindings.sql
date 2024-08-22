SELECT t.id as id, t.uid as team_uid, u.uid as user_uid, tm.created, tm.updated, tm.permission FROM {{ .Ident .TeamMemberTable }} tm
INNER JOIN {{ .Ident .TeamTable }} t ON tm.team_id = t.id
INNER JOIN {{ .Ident .UserTable }} u ON tm.user_id  = u.id
WHERE
{{ if .Query.UID }}
    t.uid = {{ .Arg .Query.UID }}
{{ else }}
    t.uid IN(SELECT uid FROM {{ .Ident .TeamTable }} t ORDER BY t.id ASC LIMIT {{ .Arg .Query.Limit }})
{{ end }}
AND tm.org_id = {{ .Arg .Query.OrgID}};
