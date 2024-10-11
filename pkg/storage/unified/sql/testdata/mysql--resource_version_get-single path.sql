SELECT
        `resource_version`,
        CAST(FLOOR(UNIX_TIMESTAMP(NOW(6)) * 1000000) AS SIGNED)
    FROM `resource_version`
    WHERE 1 = 1
        AND `group`    = 'group'
        AND `resource` = 'resource'
    FOR UPDATE
;
