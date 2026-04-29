SELECT
    {{ .Ident "uid" | .Into .Response.UID }},
    {{ .Ident "title" | .Into .Response.Title }},
    {{ .Ident "subresource" | .Into .Response.Subresource }},
    {{ .Ident "content" | .Into .Response.Content }},
    {{ .Ident "embedding" }} <=> {{ .Arg .QueryEmbedding }} AS {{ .Ident "score" | .Into .Response.Score }},
    {{ .Ident "folder" | .Into .Response.Folder }},
    {{ .Ident "metadata" | .Into .Response.Metadata }}
    FROM embeddings
    WHERE {{ .Ident "resource" }}  = {{ .Arg .Resource }}
    AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND {{ .Ident "model" }}     = {{ .Arg .Model }}
    {{ if .UIDFilter }}
    AND {{ .Ident "uid" }} IN ({{ .ArgList .UIDFilterSlice }})
    {{ end }}
    {{ if .FolderFilter }}
    AND {{ .Ident "folder" }} IN ({{ .ArgList .FolderFilterSlice }})
    {{ end }}
    {{ range .MetadataFilters }}
    AND {{ $.Ident "metadata" }} @> {{ $.Arg .JSON }}
    {{ end }}
    ORDER BY {{ .Ident "embedding" }} <=> {{ .Arg .QueryEmbedding }}
    LIMIT {{ .Arg .Limit }}
;
