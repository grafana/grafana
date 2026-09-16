DELETE FROM "test_schema"."user_auth_token"
WHERE created_at <= 1600000000
   OR seen_at <= 1650000000
