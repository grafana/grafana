SELECT "resource_version", "namespace", "name", "value"
    FROM "resource"
    WHERE 1 = 1 AND "namespace" = ?
    ORDER BY "namespace" ASC, "name" ASC
;
