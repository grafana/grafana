UPDATE "resource_history"
SET "resource_version" = (
    CASE
    WHEN "guid" = 'guid1' THEN CAST(123 AS BIGINT)
    WHEN "guid" = 'guid2' THEN CAST(456 AS BIGINT)
    END
), "key_path" = (
    CASE
    WHEN "guid" = 'guid1' THEN CONCAT(
      'unified', CHR(47), 'data', CHR(47),
      "group", CHR(47),
      "resource", CHR(47),
      "namespace", CHR(47),
      "name", CHR(47),
      CAST(((((CAST(123 AS BIGINT) / 1000) - 1288834974657) << 22) + (CAST(123 AS BIGINT) % 1000 )) AS BIGINT),
      CHR(126),
      CASE "action"
        WHEN 1 THEN 'created'
        WHEN 2 THEN 'updated'
        WHEN 3 THEN 'deleted'
      END, CHR(126),
      COALESCE("folder", ''))
    WHEN "guid" = 'guid2' THEN CONCAT(
      'unified', CHR(47), 'data', CHR(47),
      "group", CHR(47),
      "resource", CHR(47),
      "namespace", CHR(47),
      "name", CHR(47),
      CAST(((((CAST(456 AS BIGINT) / 1000) - 1288834974657) << 22) + (CAST(456 AS BIGINT) % 1000 )) AS BIGINT),
      CHR(126),
      CASE "action"
        WHEN 1 THEN 'created'
        WHEN 2 THEN 'updated'
        WHEN 3 THEN 'deleted'
      END, CHR(126),
      COALESCE("folder", ''))
    END
)
WHERE "guid" IN (
    'guid1', 'guid2'
);
