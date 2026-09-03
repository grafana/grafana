SELECT 1
FROM {{ .Ident .OrgUserTable }}
WHERE org_id = {{ .Arg .OrgID }}
  AND role = {{ .Arg .Role }}
