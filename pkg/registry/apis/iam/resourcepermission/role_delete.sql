-- Delete a specific role
DELETE FROM {{ .Ident .RoleTable }} 
WHERE id = {{ .Arg .RoleID }} 
  AND org_id = {{ .Arg .OrgID }}
