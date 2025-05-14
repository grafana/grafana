SELECT
  "resource_version",
  "namespace",
  "name",
  "folder",
  "value"
FROM "resource_history"
WHERE 1 = 1
  AND "namespace" = 'nn'
  AND "group"     = 'gg'
  AND "resource"  = 'rr'
  AND "action" = 3
  AND "resource_version" < 123456
ORDER BY resource_version DESC
