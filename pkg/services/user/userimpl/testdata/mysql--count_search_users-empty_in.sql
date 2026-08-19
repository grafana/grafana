SELECT COUNT(*) AS count
FROM `test_schema`.`user` AS u
LEFT JOIN `test_schema`.`user_auth` AS user_auth ON user_auth.id = (
  SELECT id
  FROM `test_schema`.`user_auth` AS user_auth
  WHERE user_auth.user_id = u.id
  ORDER BY user_auth.created DESC
  LIMIT 1
)
WHERE u.is_service_account = FALSE
AND 0 = 1
