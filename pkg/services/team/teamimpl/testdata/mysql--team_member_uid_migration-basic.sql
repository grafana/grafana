UPDATE `test_schema`.`team_member` SET uid = concat('tm', lpad(id, 9, '0')) WHERE uid IS NULL OR uid = ''
