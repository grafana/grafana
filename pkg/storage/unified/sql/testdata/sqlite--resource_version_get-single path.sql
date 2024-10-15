SELECT
        "resource_version",
        CAST((julianday('now') - 2440587.5) * 86400000000.0 AS BIGINT)
    FROM "resource_version"
    WHERE 1 = 1
        AND "group"    = 'group'
        AND "resource" = 'resource'
;
