INSERT INTO "resource_version"
    (
        "group",
        "resource",
        "resource_version"
    )
    VALUES (
        '',
        '',
        CAST((julianday('now') - 2440587.5) * 86400000000.0 AS INTEGER)
    )
;
