SELECT user_id, auth_module
FROM "test_schema"."user_auth"
WHERE user_id IN (42, 84)
ORDER BY created
