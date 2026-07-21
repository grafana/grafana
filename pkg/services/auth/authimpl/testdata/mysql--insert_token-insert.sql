INSERT INTO `test_schema`.`user_auth_token` (
  `user_id`, `auth_token`, `prev_auth_token`,
  `user_agent`, `client_ip`, `auth_token_seen`,
  `seen_at`, `rotated_at`, `created_at`,
  `updated_at`, `revoked_at`, `external_session_id`
) VALUES (
  2, 'token', 'previous',
  'agent', '127.0.0.1', TRUE,
  3, 4, 5,
  6, 7, 8
);
