SELECT *
FROM `test_schema`.`user`
WHERE is_service_account = FALSE
  AND email = 'alice@example.com'
