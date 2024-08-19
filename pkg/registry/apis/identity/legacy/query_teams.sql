SELECT id, uid, name, email, created, updated
  FROM {{ .Ident .TeamTable }}
 WHERE org_id = {{ .Arg .Query.OrgID }}
{{ if .Query.UID }}
   AND uid = {{ .Arg .Query.UID }}
{{ end }}
{{ if .Query.ContinueID }}
   AND id > {{ .Arg .Query.ContinueID }}
{{ end }}
 ORDER BY id asc
 LIMIT {{ .Arg .Query.Limit }}