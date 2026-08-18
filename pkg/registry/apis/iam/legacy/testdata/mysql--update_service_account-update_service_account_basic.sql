UPDATE `grafana`.`user`
SET
  name = 'Renamed Service Account',
  is_disabled = FALSE,
  updated = '2023-01-01 13:00:00'
WHERE uid = 'abcdef'
  AND org_id = 1
  AND is_service_account
