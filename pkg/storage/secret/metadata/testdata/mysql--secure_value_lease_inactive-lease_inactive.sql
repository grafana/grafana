UPDATE
  `secret_secure_value`
SET
  `lease_token` = 'token',
  `lease_created` = 10,
  `lease_duration` = (30 * POWER(2, `gc_attempts`))
WHERE
  `guid` IN ('1', '2') AND
  `active` = FALSE AND
  10 - `lease_created` > `lease_duration`
;
