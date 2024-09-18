SELECT "guid", "name", "folder", "name", "slug"
    FROM "entity"
    WHERE 1 = 1 AND "group" = ? AND "resource" = ? AND "namespace" = ?;
