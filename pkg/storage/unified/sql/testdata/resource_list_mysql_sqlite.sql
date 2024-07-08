SELECT "resource_version", "value"
    FROM "resource"
    WHERE 1 = 1 AND "namespace" = ?
    ORDER BY "resource_version" DESC
    LIMIT ?
;
