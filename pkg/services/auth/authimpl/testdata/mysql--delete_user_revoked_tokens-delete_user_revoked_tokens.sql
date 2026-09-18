DELETE FROM `test_schema`.`user_auth_token`
WHERE user_id = 10
  AND revoked_at > 0
  AND revoked_at <= 1700000000
