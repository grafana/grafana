SELECT "resource_version"
    FROM "kind_version"
    WHERE 1 = 1 AND "group" = $1 AND "resource" = $2 FOR UPDATE;
