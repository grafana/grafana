UPDATE `resource_version`
SET
    `resource_version` = MAX((UNIX_TIMESTAMP(NOW(6)) * 1000000), `resource_version` + 1)
WHERE 1 = 1
    AND `group`    = ''
    AND `resource` = ''
;
