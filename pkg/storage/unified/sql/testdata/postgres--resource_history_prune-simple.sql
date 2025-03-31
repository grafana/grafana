DELETE FROM "resource_history"
WHERE "guid" IN (
  SELECT "guid"
  FROM (
  SELECT
    "guid",
    ROW_NUMBER() OVER (
      PARTITION BY
        "namespace",
        "group",
        "resource",
        "name"
      ORDER BY "resource_version" DESC
    ) AS "rn"
  FROM "resource_history"
  WHERE
    "namespace" = 'nn'
    AND "group" = 'gg'
    AND "resource" = 'rr'
    AND "name" = 'na'
  ) AS "ranked"
  WHERE "rn" > 100
);
