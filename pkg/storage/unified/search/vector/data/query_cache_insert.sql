INSERT INTO query_embedding_cache (
    {{ .Ident "namespace" }},
    {{ .Ident "model" }},
    {{ .Ident "query_hash" }},
    {{ .Ident "embedding" }}
)
VALUES (
    {{ .Arg .Namespace }},
    {{ .Arg .Model }},
    {{ .Arg .QueryHash }},
    {{ .Arg .Embedding }}
)
ON CONFLICT ({{ .Ident "namespace" }}, {{ .Ident "model" }}, {{ .Ident "query_hash" }}) DO NOTHING
;
