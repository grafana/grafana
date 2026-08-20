UPDATE "grafana"."user"
SET
  name = 'Disabled Service Account',
  is_disabled = TRUE,
  updated = '2023-02-01 10:30:00'
WHERE uid = 'abcdef'
  AND org_id = 2
  AND is_service_account
