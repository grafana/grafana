SELECT DISTINCT "name"
FROM "resource_history"
WHERE "namespace" = 'ns'
  AND "group" = 'group'
  AND "resource" = 'res'
ORDER BY "name";
