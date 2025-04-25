WITH updates AS (
  'SELECT uid, label, encrypted_data FROM secret_data_key WHERE namespace = 'ns''
)
UPDATE "secret_data_key"
JOIN updates ON "secret_data_key".uid = updates.uid
SET
  "secret_data_key".label = updates.label,
  "secret_data_key".encrypted_data = updates.encrypted_data,
  "secret_data_key".provider = 'new-provider',
  "secret_data_key".updated = '1969-12-31 22:34:38 -0300 -03'
; 
