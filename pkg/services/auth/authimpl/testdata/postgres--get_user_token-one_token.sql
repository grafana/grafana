SELECT "id", "user_id", "auth_token", "prev_auth_token", "user_agent", "client_ip", "auth_token_seen", "seen_at", "rotated_at", "created_at", "updated_at", "revoked_at", "external_session_id" FROM "test_schema"."user_auth_token"
WHERE "id" = 1 AND "user_id" = 2;
