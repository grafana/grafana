UPDATE "test_schema"."user_auth_token" SET
  "seen_at" = 0,
  "user_agent" = 'agent',
  "client_ip" = '127.0.0.1',
  "prev_auth_token" = "auth_token",
  "auth_token" = 'hash',
  "auth_token_seen" = FALSE,
  "rotated_at" = 4
WHERE "id" = 1;
