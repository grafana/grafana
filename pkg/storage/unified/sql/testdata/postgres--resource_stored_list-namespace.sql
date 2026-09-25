SELECT DISTINCT
  "namespace",
  "group",
  "resource"
FROM "resource"
WHERE 1 = 1
  AND "namespace" = 'default'
ORDER BY
  "namespace",
  "group",
  "resource"
;
