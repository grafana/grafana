UPDATE "grafana"."api_key"
SET last_used_at = '2026-07-29 12:00:00 +0000 UTC'
WHERE org_id = 1
  AND id = 42
