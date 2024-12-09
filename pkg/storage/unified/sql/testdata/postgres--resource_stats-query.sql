SELECT
  "namespace",
  "group",
  "resource",
  COUNT(*),
  MAX("resource_version")
FROM "resource"
GROUP BY 
  "namespace",
  "group",
  "resource"
;
