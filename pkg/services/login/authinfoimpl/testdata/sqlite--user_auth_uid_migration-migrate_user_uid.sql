UPDATE "test_schema"."user_auth"
SET user_uid = (
  SELECT uid
  FROM "test_schema"."user"
  WHERE id = user_id
)
WHERE user_id IN (SELECT id FROM "test_schema"."user")
  AND user_uid IS NULL
