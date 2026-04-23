SELECT
    "name",
    "subresource",
    "content",
    "embedding" <=> '[0.1 0.2 0.3]' AS "score",
    "folder",
    "metadata"
    FROM vec_42
    WHERE 1=1
    AND "name" IN ('dash-1')
    AND "folder" IN ('folder-a', 'folder-b')
    AND "metadata" @> '{"datasource_uids":["ds-uid-1"]}'
    AND "metadata" @> '{"query_languages":["promql"]}'
    ORDER BY "embedding" <=> '[0.1 0.2 0.3]'
    LIMIT 5
;
