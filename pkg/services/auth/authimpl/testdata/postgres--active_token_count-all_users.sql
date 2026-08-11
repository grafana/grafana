SELECT COUNT(*)
FROM "test_schema"."user_auth_token"
WHERE created_at > 1600000000
  AND rotated_at > 1650000000
  AND revoked_at = 0
