UPDATE "kind_version"
    SET "resource_version" = ? + 1,
        "updated_at" = ?
    WHERE 1 = 1 AND "group" = ? AND "resource" = ? AND "resource_version" = ?;
