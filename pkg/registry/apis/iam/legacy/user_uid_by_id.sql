SELECT u.uid
FROM {{ .Ident .UserTable }} as u
INNER JOIN {{ .Ident .OrgUserTable }} as ou ON ou.user_id = u.id AND ou.org_id = {{ .Arg .Query.OrgID }}
WHERE u.id = {{ .Arg .Query.ID }}
AND u.is_service_account = {{ .Arg .Query.IsServiceAccount }}
LIMIT 1;