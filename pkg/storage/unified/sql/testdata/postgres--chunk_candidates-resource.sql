SELECT "guid",
       OCTET_LENGTH("value") AS "size"
FROM "resource"
WHERE "namespace" = 'ns'
  AND "group" = 'group'
  AND "resource" = 'res'
ORDER BY "guid"
LIMIT 2000;
