UPDATE "resource_version"
    SET "resource_version" = resource_version + 1
    WHERE 1 = 1 AND "group" = ? AND "resource" = ?
;
