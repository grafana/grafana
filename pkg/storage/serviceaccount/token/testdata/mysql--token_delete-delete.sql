DELETE FROM `serviceaccount_token`
WHERE
  `namespace` = 'org-1' AND
  `service_account_name` = 'sa-one' AND
  `name` = 'deploy'
;
