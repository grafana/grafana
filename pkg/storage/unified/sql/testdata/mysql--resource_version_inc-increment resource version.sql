UPDATE `resource_version`
SET
    `resource_version` = (UNIX_TIMESTAMP(NOW(6)) * 1000000)
WHERE 1 = 1
    AND `group`    = ''
    AND `resource` = ''
;
