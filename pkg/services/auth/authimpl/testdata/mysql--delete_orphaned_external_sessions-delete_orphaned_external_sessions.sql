DELETE FROM `test_schema`.`user_external_session`
WHERE NOT EXISTS (
  SELECT 1
  FROM `test_schema`.`user_auth_token`
  WHERE `test_schema`.`user_external_session`.id = `test_schema`.`user_auth_token`.external_session_id
)
