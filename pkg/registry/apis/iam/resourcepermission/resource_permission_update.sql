-- Update resource permission metadata
-- Note: ResourcePermissions don't have direct metadata like roles, 
-- but we track the last update time through managed role descriptions
UPDATE {{ .Ident .RoleTable }} SET 
  description = {{ .Arg .RoleDescription }},
  updated = {{ .Arg .Now }}
WHERE org_id = {{ .Arg .OrgID }} 
  AND description LIKE {{ .Arg .OldRoleDescriptionPattern }};
