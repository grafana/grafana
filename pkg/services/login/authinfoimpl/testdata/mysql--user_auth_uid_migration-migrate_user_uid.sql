UPDATE `test_schema`.`user_auth` AS ua
INNER JOIN `test_schema`.`user` AS u ON ua.user_id = u.id
SET ua.user_uid = u.uid
WHERE ua.user_uid IS NULL
