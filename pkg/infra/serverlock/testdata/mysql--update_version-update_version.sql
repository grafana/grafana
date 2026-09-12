UPDATE `test_schema`.`server_lock`
SET version = 2,
    last_execution = 123
WHERE operation_uid = 'test-operation'
  AND version = 1;
