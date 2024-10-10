INSERT INTO `resource_version`
    (
        `group`,
        `resource`,
        `resource_version`
    )
    VALUES (
        '',
        '',
        FLOOR(UNIX_TIMESTAMP(NOW(6)) * 1000000)
    )
;
