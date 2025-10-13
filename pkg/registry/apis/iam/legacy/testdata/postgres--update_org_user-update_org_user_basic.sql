-- name: update_org_user
UPDATE "grafana"."org_user"
SET
  role = 'Admin',
  updated = '2023-01-01 14:00:00'
WHERE org_id = 1 AND user_id = 123
