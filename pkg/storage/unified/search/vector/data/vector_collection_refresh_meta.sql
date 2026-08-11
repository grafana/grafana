UPDATE embeddings AS e
    SET {{ .Ident "title" }}      = v.title,
        {{ .Ident "metadata" }}   = v.metadata::jsonb,
        {{ .Ident "updated_at" }} = CURRENT_TIMESTAMP
    FROM (VALUES
        {{ range $i, $r := .Rows }}{{ if $i }},
        {{ end }}({{ $.Arg $r.Subresource }}, {{ $.Arg $r.Title }}, {{ $.Arg $r.Metadata }}){{ end }}
    ) AS v(subresource, title, metadata)
    WHERE e.{{ .Ident "resource" }}  = {{ .Arg .Resource }}
    AND e.{{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND e.{{ .Ident "model" }}     = {{ .Arg .Model }}
    AND e.{{ .Ident "uid" }}       = {{ .Arg .UID }}
    AND e.{{ .Ident "subresource" }} = v.subresource
;
