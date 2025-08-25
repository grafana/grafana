-- Delete team role assignments for a specific role
DELETE FROM {{ .Ident .TeamRoleTable }} 
WHERE role_id = {{ .Arg .RoleID }} 
  AND org_id = {{ .Arg .OrgID }}
