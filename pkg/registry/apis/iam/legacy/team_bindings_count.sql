SELECT COUNT(*)
FROM {{ .Ident .TeamMemberTable }} tm
INNER JOIN {{ .Ident .TeamTable }} t ON tm.team_id = t.id
INNER JOIN {{ .Ident .UserTable }} u ON tm.user_id  = u.id
WHERE
  tm.org_id = {{ .Arg .Query.OrgID}}
  {{ if .Query.UID }}
    AND tm.uid = {{ .Arg .Query.UID }}
  {{ end }}
  {{ if .Query.TeamUID }}
    AND t.uid = {{ .Arg .Query.TeamUID }}
  {{ end }}
  {{ if .Query.UserUID }}
    AND u.uid = {{ .Arg .Query.UserUID }}
  {{ end }}
  {{- if ne .Query.External nil }}
    AND tm.external = {{ .Arg .ExternalValue }}
  {{- end }}
;
