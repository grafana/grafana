INSERT INTO "resource_version"
    (
        "shard",
        "group",
        "resource",
        "resource_version"
    )
    VALUES (
        0,
        '',
        '',
        (EXTRACT(EPOCH FROM clock_timestamp()) * 1000000)::BIGINT
    )
;
