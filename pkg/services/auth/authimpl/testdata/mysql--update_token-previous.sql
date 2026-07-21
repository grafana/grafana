UPDATE `test_schema`.`user_auth_token` SET
  `user_id` = 2,
  `auth_token` = 'token',
  `prev_auth_token` = 'previous',
  `user_agent` = 'agent',
  `client_ip` = '127.0.0.1',
  `auth_token_seen` = TRUE,
  `seen_at` = 3,
  `rotated_at` = 4,
  `created_at` = 5,
  `updated_at` = 6,
  `revoked_at` = 7,
  `external_session_id` = 8
WHERE `id` = 1 AND `prev_auth_token` = 'expected' AND `rotated_at` < 4;
