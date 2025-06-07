WITH updates AS (
  '[SELECT uid, label, encrypted_data]'
)
UPDATE `secret_data_key`
JOIN updates ON `secret_data_key`.uid = updates.uid
SET
  `secret_data_key`.label = updates.label,
  `secret_data_key`.encrypted_data = updates.encrypted_data,
  `secret_data_key`.provider = 'provider1',
  `secret_data_key`.updated = '2024-12-31 23:00:00 +0000 UTC'
;
