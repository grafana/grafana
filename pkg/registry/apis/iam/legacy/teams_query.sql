SELECT id, uid, name, email, external_uid, is_provisioned, created, updated
  FROM {{ .Ident .TeamTable }}
 WHERE org_id = {{ .Arg .Query.OrgID }}
{{ if .Query.UID }}
   AND uid = {{ .Arg .Query.UID }}
{{ end }}
{{ if .Query.Pagination.Continue }}
   AND id >= {{ .Arg .Query.Pagination.Continue }}
{{ end }}
 ORDER BY id asc
 LIMIT {{ .Arg .Query.Pagination.Limit }}
