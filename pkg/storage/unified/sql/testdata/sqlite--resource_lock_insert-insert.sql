INSERT INTO "resource_lock"
    (
        "group",
        "resource",
        "namespace",
        "name",
        "resource_version"
    )
    SELECT 'gp', 'rs', 'ns', 'nm', MAX(rv)
    FROM (
        SELECT CAST((julianday('now') - 2440587.5) * 86400000000.0 AS BIGINT) AS rv
        UNION ALL
        SELECT MAX("resource_version") + 1 AS rv
        FROM "resource_history"
        WHERE "group"     = 'gp'
        AND "resource"  = 'rs'
    ) AS t
;
