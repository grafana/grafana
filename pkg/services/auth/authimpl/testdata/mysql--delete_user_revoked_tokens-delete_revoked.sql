DELETE FROM `test_schema`.`user_auth_token` WHERE `user_id` = 2 AND `revoked_at` > 0 AND `revoked_at` <= 7;
