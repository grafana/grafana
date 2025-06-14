SELECT r.id
FROM {{ .Ident .RoleTable }} as u
WHERE u.uid = {{ .Arg .Query.UID }}
LIMIT 1;
