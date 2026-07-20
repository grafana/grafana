SELECT
  id,
  user_id,
  user_uid,
  auth_module,
  auth_id,
  created,
  o_auth_access_token,
  o_auth_refresh_token,
  o_auth_id_token,
  o_auth_token_type,
  o_auth_expiry,
  external_uid
FROM `test_schema`.`user_auth`
WHERE 1 = 1
  AND user_id = 42
ORDER BY created DESC
LIMIT 1
