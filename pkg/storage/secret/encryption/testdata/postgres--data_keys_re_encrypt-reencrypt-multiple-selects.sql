WITH updates AS (SELECT uid, label, encrypted_data from secret_data_key where namespace = 'ns1' UNION ALL SELECT uid, label, encrypted_data from secret_data_key where namespace = 'ns2')
UPDATE "secret_data_key"
JOIN updates ON "secret_data_key".uid = updates.uid
SET
  "secret_data_key".label = updates.label,
  "secret_data_key".encrypted_data = updates.encrypted_data,
  "secret_data_key".provider = 'provider1',
  "secret_data_key".updated = '2025-01-01 02:00:00 +0200 EET'
;
