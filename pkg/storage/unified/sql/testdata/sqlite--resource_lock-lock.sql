INSERT INTO "resource_lock"
    (
        "group",
        "resource",
        "namespace",
        "name",
        "resource_version"
    )
    VALUES (
        'gp',
        'rs',
        'ns',
        'nm',
        CAST((julianday('now') - 2440587.5) * 86400000000.0 AS BIGINT)
    )
;
