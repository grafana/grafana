SELECT
    {{ .Ident "name" | .Into .Response.Name }},
    {{ .Ident "subresource" | .Into .Response.Subresource }},
    {{ .Ident "content" | .Into .Response.Content }},
    {{ .Ident "embedding" }} <=> {{ .Arg .QueryEmbedding }} AS {{ .Ident "score" | .Into .Response.Score }},
    {{ .Ident "folder" | .Into .Response.Folder }},
    {{ .Ident "metadata" | .Into .Response.Metadata }}
    FROM {{ .Table }}
    WHERE 1=1
    {{ if .NameFilter }}
    AND {{ .Ident "name" }} IN ({{ .ArgList .NameFilterSlice }})
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
