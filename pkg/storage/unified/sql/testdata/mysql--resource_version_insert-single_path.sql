INSERT INTO `resource_version`
    (
        `group`,
        `resource`,
        `resource_version`
    )
    VALUES (
        '',
        '',
        CAST(FLOOR(UNIX_TIMESTAMP(NOW(6)) * 1000000) AS SIGNED)
    )
;
