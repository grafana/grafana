SELECT COALESCE(ou.role, 'None') AS role, u.is_admin
FROM {{ .Ident .UserTable }} as u
  LEFT JOIN {{ .Ident .OrgUserTable }} as ou ON ou.user_id = u.id AND ou.org_id = {{ .Arg .Query.OrgID }}
WHERE u.id = {{ .Arg .Query.UserID }}
