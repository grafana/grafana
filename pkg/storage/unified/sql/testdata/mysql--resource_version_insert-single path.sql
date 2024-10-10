INSERT INTO `resource_version`
    (
        `shard`,
        `group`,
        `resource`,
        `resource_version`
    )
    VALUES (
        0,
        '',
        '',
        FLOOR(UNIX_TIMESTAMP(NOW(6)) * 1000000)
    )
;
