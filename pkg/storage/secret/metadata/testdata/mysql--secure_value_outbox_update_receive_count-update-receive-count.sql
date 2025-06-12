UPDATE 
  `secret_secure_value_outbox`
SET
  `receive_count` = `receive_count` + 1
WHERE 
  `uid` IN ('id1', 'id2', 'id3')
;
