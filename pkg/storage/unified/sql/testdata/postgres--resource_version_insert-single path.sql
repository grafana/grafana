INSERT INTO "resource_version"
    (
        "group",
        "resource",
        "resource_version"
    )
    VALUES (
        '',
        '',
        EXTRACT(EPOCH FROM clock_timestamp()) * 1000000::BIGINT
    )
;
