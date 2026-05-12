INSERT INTO embeddings (
    {{ .Ident "resource" }},
    {{ .Ident "namespace" }},
    {{ .Ident "model" }},
    {{ .Ident "uid" }},
    {{ .Ident "title" }},
    {{ .Ident "subresource" }},
    {{ .Ident "folder" }},
    {{ .Ident "content" }},
    {{ .Ident "metadata" }},
    {{ .Ident "embedding" }}
)
VALUES (
    {{ .Arg .Resource }},
    {{ .Arg .Vector.Namespace }},
    {{ .Arg .Vector.Model }},
    {{ .Arg .Vector.UID }},
    {{ .Arg .Vector.Title }},
    {{ .Arg .Vector.Subresource }},
    {{ .Arg .Vector.Folder }},
    {{ .Arg .Vector.Content }},
    {{ .Arg .Vector.Metadata }},
    {{ .Arg .Embedding }}
)
ON CONFLICT ({{ .Ident "resource" }}, {{ .Ident "namespace" }}, {{ .Ident "model" }}, {{ .Ident "uid" }}, {{ .Ident "subresource" }})
DO UPDATE SET
    {{ .Ident "title" }}     = {{ .Arg .Vector.Title }},
    {{ .Ident "folder" }}    = {{ .Arg .Vector.Folder }},
    {{ .Ident "content" }}   = {{ .Arg .Vector.Content }},
    {{ .Ident "metadata" }}  = {{ .Arg .Vector.Metadata }},
    {{ .Ident "embedding" }} = {{ .Arg .Embedding }}
;
