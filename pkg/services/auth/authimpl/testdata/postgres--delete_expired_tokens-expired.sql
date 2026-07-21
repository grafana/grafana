DELETE FROM "test_schema"."user_auth_token" WHERE "created_at" <= 8 OR "rotated_at" <= 9;
