SELECT COUNT(*) FROM "test_schema"."user_auth_token"
WHERE "created_at" > 5 AND "rotated_at" > 6 AND "revoked_at" = 0 AND "user_id" = 2;
