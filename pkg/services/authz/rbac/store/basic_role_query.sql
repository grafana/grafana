SELECT ou.role, u.is_admin
FROM {{ .Ident .UserTable }} as u
  JOIN {{ .Ident .OrgUserTable }} as ou ON ou.user_id = u.id
WHERE ou.org_id = {{ .Arg .Query.OrgID }} AND u.id = {{ .Arg .Query.UserID }}
