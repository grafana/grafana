-- Query to reconstruct ResourcePermissions from managed roles and their permissions
-- We look for managed roles that were created for ResourcePermissions (those with descriptions indicating ResourcePermission)
-- and extract the permissions + target resource information from those roles
SELECT 
  p.id, p.action, p.scope, p.created, p.updated,
  -- Extract ResourcePermission name from role description
  SUBSTR(r.description, LENGTH('Managed role for ResourcePermission: ') + 1) as subject_uid,
  'resourcepermission' as subject_type,
  0 as is_service_account,
  r.name as role_name
FROM "grafana"."permission" p
INNER JOIN "grafana"."role" r ON p.role_id = r.id
WHERE r.description LIKE 'Managed role for ResourcePermission: %'
ORDER BY subject_uid, p.scope, p.id
LIMIT 15
OFFSET 5
