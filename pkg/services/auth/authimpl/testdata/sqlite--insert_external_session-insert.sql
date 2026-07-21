INSERT INTO "test_schema"."user_external_session" (
  "user_id", "user_auth_id", "auth_module",
  "access_token", "id_token", "refresh_token",
  "session_id", "session_id_hash", "name_id",
  "name_id_hash", "expires_at", "created_at"
) VALUES (
  2, 3, 'oauth',
  'access', 'id', 'refresh',
  'session', 'session-hash', 'name',
  'name-hash', '2026-07-21 12:00:00', '2026-07-21 12:00:00'
);
