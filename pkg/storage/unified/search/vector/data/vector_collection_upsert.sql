INSERT INTO {{ .Table }} (
    {{ .Ident "name" }},
    {{ .Ident "subresource" }},
    {{ .Ident "folder" }},
    {{ .Ident "content" }},
    {{ .Ident "metadata" }},
    {{ .Ident "embedding" }}
)
VALUES (
    {{ .Arg .Vector.Name }},
    {{ .Arg .Vector.Subresource }},
    {{ .Arg .Vector.Folder }},
    {{ .Arg .Vector.Content }},
    {{ .Arg .Vector.Metadata }},
    {{ .Arg .Embedding }}
)
ON CONFLICT ({{ .Ident "name" }}, {{ .Ident "subresource" }})
DO UPDATE SET
    {{ .Ident "folder" }}    = {{ .Arg .Vector.Folder }},
    {{ .Ident "content" }}   = {{ .Arg .Vector.Content }},
    {{ .Ident "metadata" }}  = {{ .Arg .Vector.Metadata }},
    {{ .Ident "embedding" }} = {{ .Arg .Embedding }}
;
