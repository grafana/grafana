UPDATE `grafana`.`user`
SET
  name = 'Disabled Service Account',
  is_disabled = TRUE,
  updated = '2023-02-01 10:30:00'
WHERE uid = 'abcdef' AND is_service_account
  AND updated = '2023-02-01 09:30:00'
