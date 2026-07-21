SELECT "id", "user_id", "user_auth_id", "auth_module", "access_token", "id_token", "refresh_token", "session_id", "session_id_hash", "name_id", "name_id_hash", "expires_at", "created_at" FROM "test_schema"."user_external_session"
WHERE "id" = 1 AND "user_id" = 2 AND "session_id_hash" = 'session-hash' AND "name_id_hash" = 'name-hash'
ORDER BY "id" DESC;
