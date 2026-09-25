DELETE FROM {{ .Ident .Table }}
WHERE org_id = {{ .Arg .OrgID }}
  AND user_id = {{ .Arg .UserID }}
