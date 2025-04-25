UPDATE "secret_data_key"
SET
  "active" = false,
  "updated" = '1969-12-31 22:34:38 -0300 -03'
WHERE 1 = 1 AND
  "namespace" = 'ns' AND
  "active" = true
; 
