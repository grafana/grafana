SELECT uid
FROM {{ .Ident .TeamTable }}
WHERE org_id = {{ .Arg .OrgID }}
  AND id = {{ .Arg .TeamID }}
