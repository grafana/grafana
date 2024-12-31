SELECT
    MIN("resource_version")
    FROM "resource_lock"
    WHERE 1 = 1
    AND "group"     = 'gp'
    AND "resource"  = 'rs'
;
