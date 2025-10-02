SELECT
    "namespace",
    "group",
    "resource",
    "name",
    "resource_version",
    "action",
    "value"
FROM resource_history
WHERE "namespace" = 'ns'
  AND "group" = 'group'
  AND "resource" = 'res'
  AND "resource_version" > 10000 
  AND "resource_version" <= 20000 
ORDER BY "name" ASC, "resource_version" DESC
