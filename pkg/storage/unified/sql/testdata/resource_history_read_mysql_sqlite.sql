SELECT "resource_version", "value"
    FROM "resource_history"
    WHERE 1 = 1 AND "namespace" = ? AND "group" = ? AND "resource" = ? AND "name" = ? AND "resource_version" <= ?
    ORDER BY "resource_version" DESC
    LIMIT 1  
;
