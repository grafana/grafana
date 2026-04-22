DELETE FROM {{ .Ident "resource_embeddings" }}
    WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND {{ .Ident "group" }}       = {{ .Arg .Group }}
    AND {{ .Ident "resource" }}    = {{ .Arg .Resource }}
    AND {{ .Ident "name" }}        = {{ .Arg .Name }}
    {{ if .HasModel }}
    AND {{ .Ident "model" }} = {{ .Arg .Model }}
    {{ end }}
    {{ if .HasOlderThanRV }}
    AND {{ .Ident "resource_version" }} < {{ .Arg .OlderThanRV }}
    {{ end }}
;
