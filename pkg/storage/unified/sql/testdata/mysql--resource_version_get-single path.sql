SELECT
        `resource_version`,
        (UNIX_TIMESTAMP(NOW(6)) * 1000000)
    FROM `resource_version`
    WHERE 1 = 1
        AND `group`    = 'group'
        AND `resource` = 'resource'
    FOR UPDATE
;
