UPDATE `test_schema`.`user_external_session` SET
  `access_token` = 'access',
  `refresh_token` = 'refresh',
  `id_token` = 'id',
  `expires_at` = '2026-07-21 12:00:00'
WHERE `id` = 1;
