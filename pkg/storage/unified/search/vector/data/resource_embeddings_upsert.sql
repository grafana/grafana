INSERT INTO {{ .Ident "resource_embeddings" }} (
    {{ .Ident "namespace" }},
    {{ .Ident "group" }},
    {{ .Ident "resource" }},
    {{ .Ident "name" }},
    {{ .Ident "subresource" }},
    {{ .Ident "resource_version" }},
    {{ .Ident "folder" }},
    {{ .Ident "content" }},
    {{ .Ident "metadata" }},
    {{ .Ident "embedding" }},
    {{ .Ident "model" }}
)
VALUES (
    {{ .Arg .Vector.Namespace }},
    {{ .Arg .Vector.Group }},
    {{ .Arg .Vector.Resource }},
    {{ .Arg .Vector.Name }},
    {{ .Arg .Vector.Subresource }},
    {{ .Arg .Vector.ResourceVersion }},
    {{ .Arg .Vector.Folder }},
    {{ .Arg .Vector.Content }},
    {{ .Arg .Vector.Metadata }},
    {{ .Arg .Embedding }},
    {{ .Arg .Vector.Model }}
)
ON CONFLICT ({{ .Ident "namespace" }}, {{ .Ident "group" }}, {{ .Ident "resource" }}, {{ .Ident "name" }}, {{ .Ident "subresource" }})
DO UPDATE SET
    {{ .Ident "resource_version" }} = {{ .Arg .Vector.ResourceVersion }},
    {{ .Ident "folder" }}           = {{ .Arg .Vector.Folder }},
    {{ .Ident "content" }}          = {{ .Arg .Vector.Content }},
    {{ .Ident "metadata" }}         = {{ .Arg .Vector.Metadata }},
    {{ .Ident "embedding" }}        = {{ .Arg .Embedding }},
    {{ .Ident "model" }}            = {{ .Arg .Vector.Model }}
;
