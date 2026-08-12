UPDATE
  `secret_secure_value`
SET
  `lease_token` = 'token',
  `lease_created` = 10,
  `lease_duration` = (30 * POWER(2, `gc_attempts`))
WHERE `guid` IN (
  SELECT `guid` FROM (
    SELECT
      `guid`,
      ROW_NUMBER() OVER (ORDER BY `created` ASC) AS rn
    FROM `secret_secure_value`
    WHERE
      `active` = FALSE AND
      10 - `updated` > 300 AND
      10 - `lease_created` > `lease_duration`
  ) AS sub 
  WHERE rn <= 10
)
;
