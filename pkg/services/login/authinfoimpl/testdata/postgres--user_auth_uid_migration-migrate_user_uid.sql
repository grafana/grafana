UPDATE "test_schema"."user_auth" AS ua
SET user_uid = u.uid
FROM "test_schema"."user" AS u
WHERE u.id = ua.user_id
  AND ua.user_uid IS NULL
