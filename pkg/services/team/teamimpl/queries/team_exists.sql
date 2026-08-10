SELECT 1
FROM {{ .Ident .TeamTable }}
WHERE org_id = {{ .Arg .OrgID }}
  AND id = {{ .Arg .TeamID }}
