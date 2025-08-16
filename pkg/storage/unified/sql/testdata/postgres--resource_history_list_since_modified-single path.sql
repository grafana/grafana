SELECT
    "guid",
    "resource_version",
    "namespace",
    "group",
    "resource",
    "name",
    "folder",
    "value",
    "action"
FROM resource_history
WHERE "namespace" = 'ns'
  AND "group" = 'group'
  AND "resource" = 'res'
  AND "resource_version" > 10000 -- needs to be exclusive of the sinceRv
ORDER BY "resource_version", "group", "resource", "name"
  DESC
