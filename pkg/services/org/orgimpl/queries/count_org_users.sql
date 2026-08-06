SELECT COUNT(*) AS count
FROM (
  SELECT user_id
  FROM {{ .Ident .OrgUserTable }}
  WHERE org_id = {{ .Arg .OrgID }}
    AND user_id IN (
      SELECT id
      FROM {{ .Ident .UserTable }}
      WHERE is_service_account = {{ .Arg .IsServiceAccount }}
    )
) AS subq
