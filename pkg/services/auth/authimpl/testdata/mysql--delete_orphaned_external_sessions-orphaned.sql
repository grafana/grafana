DELETE FROM `test_schema`.`user_external_session`
WHERE NOT EXISTS (
  SELECT 1 FROM `test_schema`.`user_auth_token` AS `token`
  WHERE `user_external_session`.`id` = `token`.`external_session_id`
);
