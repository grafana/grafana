UPDATE "test_schema"."user_auth"
SET auth_id = 'auth-id',
    external_uid = 'external-uid',
    created = '2025-07-22 15:00:00',
    o_auth_expiry = '2025-07-22 15:00:00',
    o_auth_access_token = 'access-token',
    o_auth_refresh_token = 'refresh-token',
    o_auth_id_token = 'id-token',
    o_auth_token_type = 'bearer'
WHERE user_id = 42
  AND auth_module = 'ldap'
