-- Delete from user_auth table for a specific user
DELETE FROM "grafana"."user_auth"
WHERE user_id = ?
