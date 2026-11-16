UPDATE `test_schema`.`user_auth_token`
SET
  seen_at = 0,
  user_agent = 'some-user-agent',
  client_ip = '10.0.0.1',
  prev_auth_token = auth_token,
  auth_token = 'hashed-token',
  auth_token_seen = FALSE,
  rotated_at = 1700000000
WHERE id = 42
