SELECT "resource_version"
    FROM "kind_version"
    WHERE 1 = 1 AND "group" = ? AND "resource" = ? FOR UPDATE;
