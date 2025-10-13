SELECT u.id
FROM {{ .Ident .UserTable }} as u
INNER JOIN {{ .Ident .OrgUserTable }} as o ON u.id = o.user_id
WHERE o.org_id = {{ .Arg .Query.OrgID }}
AND u.uid = {{ .Arg .Query.UID }}
AND u.is_service_account
LIMIT 1;
