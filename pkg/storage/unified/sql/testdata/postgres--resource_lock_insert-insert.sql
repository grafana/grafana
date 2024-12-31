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
        SELECT (EXTRACT(EPOCH FROM statement_timestamp()) * 1000000)::BIGINT AS rv
        UNION ALL
        SELECT MAX("resource_version") + 1 AS rv
        FROM "resource_history"
        WHERE "group"     = 'gp'
        AND "resource"  = 'rs'
    ) AS t
;
