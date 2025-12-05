UPDATE `resource_history`
SET `resource_version` = (
    CASE
    WHEN `guid` = 'guid1' THEN CAST(123 AS SIGNED)
    WHEN `guid` = 'guid2' THEN CAST(456 AS SIGNED)
    END
), `key_path` = (
    CASE
    END
)
WHERE `guid` IN (
    'guid1', 'guid2'
);
