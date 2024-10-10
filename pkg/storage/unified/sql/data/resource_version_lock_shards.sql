SELECT
        {{ .Ident "shard" | .Into .Shard }},
    FROM {{ .Ident "resource_version" }}
    WHERE 1 = 1
        AND {{ .Ident "group" }}    = {{ .Arg .Group }}
        AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
    {{ .SelectFor "UPDATE SKIP LOCKED" }}
;
