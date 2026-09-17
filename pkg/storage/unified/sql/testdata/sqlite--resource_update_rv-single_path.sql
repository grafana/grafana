UPDATE "resource"
SET "resource_version" = (
    CASE
    WHEN "guid" = 'guid1' THEN CAST(123 AS SIGNED)
    WHEN "guid" = 'guid2' THEN CAST(456 AS SIGNED)
    END
)
WHERE "guid" IN (
    'guid1', 'guid2'
);
