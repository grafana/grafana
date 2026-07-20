INSERT INTO vector_search_rate_buckets (
    {{ .Ident "namespace" }},
    {{ .Ident "window_start" }},
    {{ .Ident "request_count" }}
)
VALUES (
    {{ .Arg .Namespace }},
    {{ .Arg .WindowStart }},
    1
)
ON CONFLICT ({{ .Ident "namespace" }}, {{ .Ident "window_start" }})
DO UPDATE SET {{ .Ident "request_count" }} = vector_search_rate_buckets.{{ .Ident "request_count" }} + 1
RETURNING {{ .Ident "request_count" | .Into .Response.Count }}
;
