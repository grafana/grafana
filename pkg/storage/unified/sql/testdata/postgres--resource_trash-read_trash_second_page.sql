SELECT
  h."guid",
  h."resource_version",
  h."namespace",
  h."group",
  h."resource",
  h."name",
  h."folder",
  h."value"
FROM "resource_history" h
INNER JOIN (
  SELECT "name", MAX("resource_version") as max_rv
  FROM "resource_history"
  WHERE 1 = 1
    AND "namespace" = 'nn'
    AND "group"     = 'gg'
    AND "resource"  = 'rr'
    AND "action" = 3
    AND "resource_version" < 123456
  GROUP BY "name"
) max_versions ON h."name" = max_versions."name" 
  AND h."resource_version" = max_versions.max_rv
WHERE 1 = 1
  AND h."namespace" = 'nn'
  AND h."group"     = 'gg'
  AND h."resource"  = 'rr'
  AND h."action" = 3
  AND NOT EXISTS (
    SELECT 1 FROM "resource" r
    WHERE r."namespace" = h."namespace"
      AND r."group" = h."group"
      AND r."resource" = h."resource"
      AND r."name" = h."name"
  )
ORDER BY h."resource_version" DESC
