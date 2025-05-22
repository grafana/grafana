SELECT
  `message_id`,
  `receive_count`
FROM
  `secret_secure_value_outbox_metadata`
WHERE 
  `message_id` IN ("id1", "id2", "id3")
;
