SELECT auth_module
FROM `test_schema`.`user_auth`
WHERE user_id = 42
ORDER BY created DESC
