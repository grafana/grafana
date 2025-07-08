UPDATE 
  "secret_secure_value_outbox"
SET
  "receive_count" = "receive_count" + 1
WHERE 
  "id" IN (1, 2, 3)
;
