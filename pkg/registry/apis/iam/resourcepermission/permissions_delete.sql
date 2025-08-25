-- Delete all permissions associated with a specific role
DELETE FROM {{ .Ident .PermissionTable }} 
WHERE role_id = {{ .Arg .RoleID }}
