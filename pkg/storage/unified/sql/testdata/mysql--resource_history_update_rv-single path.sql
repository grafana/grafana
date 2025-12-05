UPDATE `resource_history`
SET `resource_version` = (
    CASE
    WHEN `guid` = 'guid1' THEN CAST(123 AS SIGNED)
    WHEN `guid` = 'guid2' THEN CAST(456 AS SIGNED)
    END
), `key_path` = (
    CASE
    WHEN `guid` = 'guid1' THEN CONCAT(
      'unified', CHAR(47), 'data', CHAR(47),
      `group`, CHAR(47),
      `resource`, CHAR(47),
      `namespace`, CHAR(47),
      `name`, CHAR(47),
      CAST(((((CAST(123 AS SIGNED) / 1000) - 1288834974657) << 22) + (CAST(123 AS SIGNED) % 1000 )) AS SIGNED),
      CHAR(126),
      CASE `action`
        WHEN 1 THEN 'created'
        WHEN 2 THEN 'updated'
        WHEN 3 THEN 'deleted'
      END, CHAR(126),
      COALESCE(`folder`, ''))
    WHEN `guid` = 'guid2' THEN CONCAT(
      'unified', CHAR(47), 'data', CHAR(47),
      `group`, CHAR(47),
      `resource`, CHAR(47),
      `namespace`, CHAR(47),
      `name`, CHAR(47),
      CAST(((((CAST(456 AS SIGNED) / 1000) - 1288834974657) << 22) + (CAST(456 AS SIGNED) % 1000 )) AS SIGNED),
      CHAR(126),
      CASE `action`
        WHEN 1 THEN 'created'
        WHEN 2 THEN 'updated'
        WHEN 3 THEN 'deleted'
      END, CHAR(126),
      COALESCE(`folder`, ''))
    END
)
WHERE `guid` IN (
    'guid1', 'guid2'
);
