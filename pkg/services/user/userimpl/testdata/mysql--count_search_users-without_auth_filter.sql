SELECT COUNT(*) AS count
FROM `test_schema`.`user` AS u
WHERE u.is_service_account = FALSE
