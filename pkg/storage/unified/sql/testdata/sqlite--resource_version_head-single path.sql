 SELECT
    MIN("rv") AS rv,
    CAST((julianday('now') - 2440587.5) * 86400000000.0 AS BIGINT) AS current_epoch
    FROM (
        SELECT MAX("resource_version") AS rv
        FROM "resource_history"
        WHERE "group"     = 'group'
        AND "resource"  = 'resource'
        UNION ALL
        SELECT MIN("resource_version") - 1 AS rv
        FROM "resource_lock"
        WHERE "group"     = 'group'
        AND "resource"  = 'resource'
        UNION ALL
        SELECT CAST((julianday('now') - 2440587.5) * 86400000000.0 AS BIGINT) AS rv
    ) AS t
    WHERE rv IS NOT NULL
;
