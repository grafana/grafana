SELECT "resource_version", "created_at", "updated_at"
    FROM "kind_version"
    WHERE 1 = 1 AND "group" = ? AND "resource" = ?;
