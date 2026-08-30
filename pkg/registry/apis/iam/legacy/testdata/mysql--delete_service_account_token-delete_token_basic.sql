DELETE FROM `grafana`.`api_key`
WHERE name = 'my-token'
  AND org_id = 1
  AND service_account_id = 42
