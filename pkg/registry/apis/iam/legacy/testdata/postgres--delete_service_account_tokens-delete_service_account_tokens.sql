DELETE FROM "grafana"."api_key"
WHERE org_id = 1
  AND service_account_id = 42
