SELECT kv."resource_version", "value"
FROM "resource_history" as kv
JOIN (
	SELECT "guid", max("resource_version") AS "resource_version"
	FROM "resource_history" AS mkv
	WHERE 1 = 1 AND "resource_version" <= ? AND "namespace" = ?
	GROUP BY mkv."namespace", mkv."group", mkv."resource", mkv."name"
) AS maxkv ON maxkv."guid" = kv."guid"
WHERE kv."action" != 3
ORDER BY kv."resource_version" ASC
LIMIT ?, ?
;
