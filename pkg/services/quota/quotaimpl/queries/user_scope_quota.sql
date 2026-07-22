SELECT target, {{ .Ident "limit" }}
FROM {{ .Ident .QuotaTable }}
WHERE user_id = {{ .Arg .UserID }}
  AND org_id = {{ .Arg .OrgID }}
