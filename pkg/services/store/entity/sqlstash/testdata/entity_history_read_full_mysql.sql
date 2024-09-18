SELECT e."guid", e."resource_version", e."key", e."group", e."group_version", e."resource", e."namespace", e."name", e."folder", e."meta", e."body", e."status", e."size", e."etag", e."created_at", e."created_by", e."updated_at", e."updated_by", e."origin", e."origin_key", e."origin_ts", e."title", e."slug", e."description", e."message", e."labels", e."fields", e."errors", e."action"
    FROM "entity_history" AS e
    WHERE 1 = 1 AND "namespace" = ? AND "group" = ? AND "resource" = ? AND "name" = ? AND "resource_version" <= ?
    ORDER BY "resource_version" DESC
    LIMIT 1 FOR UPDATE NOWAIT;
