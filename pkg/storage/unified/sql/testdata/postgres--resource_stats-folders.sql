SELECT
  "namespace",
  "group",
  "resource",
  COUNT(*),
  MAX("resource_version")
FROM "resource"
WHERE 1 = 1
  AND "namespace" = 'default'
  AND "folder" IN ('a', 'b', 'c')
GROUP BY 
  "namespace",
  "group",
  "resource"
;
