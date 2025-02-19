SELECT
  "uuid",
  "value",
  "content_type"
FROM "resource_blob"
WHERE 1 = 1
  AND "namespace" = 'x'
  AND "group"     = 'g'
  AND "resource"  = 'r'
ORDER BY "created" DESC
LIMIT 1;
