UPDATE
  "secret_encrypted_value"
SET
  "encrypted_data" = '[115 101 99 114 101 116]',
  "updated" = 5679
WHERE 
  "namespace" = 'ns' AND
  "name" = 'n1' AND
  "version" = 1
;
