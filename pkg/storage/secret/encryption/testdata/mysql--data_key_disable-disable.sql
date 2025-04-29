UPDATE
  `secret_data_key`
SET
  `active` = false,
  `updated` = '2025-01-01 02:00:00 +0200 EET'
WHERE 1 = 1 AND
  `namespace` = 'ns' AND
  `active` = true
;
