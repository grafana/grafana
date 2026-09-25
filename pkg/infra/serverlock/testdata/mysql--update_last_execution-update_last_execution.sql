UPDATE `test_schema`.`server_lock`
SET last_execution = 123
WHERE operation_uid = 'test-operation';
