}
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
  `status_phase`,
  `status_message`,
  `title`,
  `keeper`,
  `decrypters`
  `ref`
  `external_id`
FROM
  `secret_secure_value`
WHERE 1 = 1 AND
  `namespace` = 'ns' AND
  `name` = 'name'
ORDER BY `updated` DESC
;
