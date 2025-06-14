UPDATE
  `secret_secure_value`
SET
  `status_phase` = 'Succeeded',
  `status_message` = 'message-1'
WHERE `namespace` = 'ns' AND
  `name` = 'name'
;
