SELECT
  `guid`,
  `name`,
  `namespace`,
  `annotations`,
  `labels`,
  `created`,
  `created_by`,
  `updated`,
  `updated_by`,
  `description`,
  `type`,
  `payload`
FROM
  `secret_keeper`
WHERE 
  `namespace` = 'ns' AND
  `active` = true
LIMIT 1
;
