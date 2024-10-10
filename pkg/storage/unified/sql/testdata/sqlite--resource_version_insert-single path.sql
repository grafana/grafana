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
        CAST((julianday('now') - 2440587.5) * 86400000000.0 AS BIGINT)
    )
;
