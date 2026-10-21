SELECT
  `guid`
FROM
  `secret_secure_value`
WHERE
  `active` = FALSE AND
  10 - `updated` > 300 AND
  10 - `lease_created` > `lease_duration`
ORDER BY `created` ASC
LIMIT 10
;
