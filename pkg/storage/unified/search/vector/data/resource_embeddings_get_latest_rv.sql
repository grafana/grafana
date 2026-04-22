SELECT
    COALESCE(MAX({{ .Ident "resource_version" }}), 0) AS {{ .Ident "resource_version" | .Into .Response.ResourceVersion }}
    FROM {{ .Ident "resource_embeddings" }}
    WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND {{ .Ident "model" }} = {{ .Arg .Model }}
;
