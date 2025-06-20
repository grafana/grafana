SELECT p.role_id, p.action, p.scope
  FROM {{ .Ident .PermissionTable }} as p
 WHERE p.role_id IN ( {{ .ArgList .Query.RoleIDs }} )