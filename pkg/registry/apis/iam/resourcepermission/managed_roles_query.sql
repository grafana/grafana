-- Query to find all managed roles associated with a specific resource permission
-- These are roles with descriptions like "Managed role for ResourcePermission: <name>"
SELECT r.id, r.name 
FROM {{ .Ident .RoleTable }} as r
WHERE r.org_id = {{ .Arg .OrgID }} 
  AND r.description = {{ .Arg .RoleDescription }}
ORDER BY r.id
