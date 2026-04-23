SELECT
    "name",
    "subresource",
    "content",
    "embedding" <=> '[0.1 0.2 0.3]' AS "score",
    "folder",
    "metadata"
    FROM vec_42
    WHERE 1=1
    AND "name" IN ('dash-1', 'dash-2')
    ORDER BY "embedding" <=> '[0.1 0.2 0.3]'
    LIMIT 10
;
