UPDATE "test_schema"."user_auth" AS ua
SET user_uid = (
  SELECT uid
  FROM "test_schema"."user" AS u
  WHERE u.id = ua.user_id
)
WHERE ua.user_id IN (SELECT id FROM "test_schema"."user")
  AND ua.user_uid IS NULL
