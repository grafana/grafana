-- Delete builtin role assignments for a specific role
DELETE FROM {{ .Ident .BuiltinRoleTable }} 
WHERE role_id = {{ .Arg .RoleID }} 
  AND org_id = {{ .Arg .OrgID }}
