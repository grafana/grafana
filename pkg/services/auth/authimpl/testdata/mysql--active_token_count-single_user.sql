SELECT COUNT(*)
FROM `test_schema`.`user_auth_token`
WHERE created_at > 1600000000
  AND seen_at > 1650000000
  AND revoked_at = 0
  AND user_id = 10
