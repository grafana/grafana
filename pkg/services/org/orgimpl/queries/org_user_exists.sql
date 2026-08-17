SELECT 1
FROM {{ .Ident .OrgUserTable }}
WHERE org_id = {{ .Arg .OrgID }}
  AND user_id = {{ .Arg .UserID }}
