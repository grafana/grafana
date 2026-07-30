SELECT
  t.id,
  t.name,
  t.is_revoked,
  t.last_used_at,
  t.expires,
  t.created,
  t.updated,
  u.uid,
  t.service_account_id
  FROM {{ .Ident .TokenTable }} as t
  INNER JOIN {{ .Ident .UserTable }} as u ON t.service_account_id = u.id
WHERE t.org_id = {{ .Arg .Query.OrgID }}
   AND u.is_service_account
   AND t.key = {{ .Arg .Query.Hash }}
LIMIT 1
