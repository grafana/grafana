UPDATE "grafana"."user"
SET
  name = 'Renamed Service Account',
  is_disabled = FALSE,
  updated = '2023-01-01 13:00:00'
WHERE uid = 'abcdef' AND is_service_account
  AND updated = '2023-01-01 12:00:00'
