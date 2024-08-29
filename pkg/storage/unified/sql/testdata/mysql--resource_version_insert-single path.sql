INSERT INTO `resource_version`
    (
        `group`,
        `resource`,
        `resource_version`
    )
    VALUES (
        '',
        '',
        (UNIX_TIMESTAMP(NOW(6)) * 1000000)
    )
;
