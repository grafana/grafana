-- Delete user role assignments for a specific role
DELETE FROM {{ .Ident .UserRoleTable }} 
WHERE role_id = {{ .Arg .RoleID }} 
  AND org_id = {{ .Arg .OrgID }}
