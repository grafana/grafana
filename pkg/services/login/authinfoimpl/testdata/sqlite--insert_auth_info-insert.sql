INSERT INTO "test_schema"."user_auth" (
  user_id,
  user_uid,
  auth_module,
  auth_id,
  created,
  o_auth_access_token,
  o_auth_refresh_token,
  o_auth_id_token,
  o_auth_token_type,
  o_auth_expiry,
  external_uid
)
VALUES (
  42,
  'user-uid',
  'ldap',
  'auth-id',
  '2025-07-22 15:00:00',
  'access-token',
  'refresh-token',
  'id-token',
  'bearer',
  '2025-07-22 15:00:00',
  'external-uid'
)
