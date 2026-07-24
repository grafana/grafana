SELECT id
FROM `test_schema`.`user_auth`
WHERE user_id = 42
  AND auth_module = 'ldap'
  AND auth_id = 'auth-id'
