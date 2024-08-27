SELECT tm.id as id, t.uid as team_uid, t.id as team_id, u.uid as user_uid, tm.created, tm.updated, tm.permission FROM {{ .Ident .TeamMemberTable }} tm
INNER JOIN {{ .Ident .TeamTable }} t ON tm.team_id = t.id
INNER JOIN {{ .Ident .UserTable }} u ON tm.user_id  = u.id
WHERE
{{ if .Query.UID }}
    t.uid = {{ .Arg .Query.UID }}
{{ else }}
    t.uid IN(
      SELECT uid
      FROM {{ .Ident .TeamTable }} t
      {{ if .Query.ContinueID }}
        WHERE t.id >= {{ .Arg .Query.ContinueID }}
      {{ end }}
      ORDER BY t.id ASC LIMIT {{ .Arg .Query.Limit }}
    )
{{ end }}
AND tm.org_id = {{ .Arg .Query.OrgID}}
ORDER BY t.id ASC;
