UPDATE
  "secret_data_key"
SET
  "active" = false,
  "updated" = '2025-01-01 00:00:00 +0000 UTC'
WHERE 1 = 1 AND
  "namespace" = 'ns' AND
  "active" = true
;
