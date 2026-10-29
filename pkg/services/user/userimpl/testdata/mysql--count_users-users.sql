SELECT COUNT(*) AS count
FROM `test_schema`.`user`
WHERE is_service_account = FALSE
