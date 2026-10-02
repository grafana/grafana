SELECT
    {{ .Ident "uid" | .Into .Response.UID }},
    {{ .Ident "title" | .Into .Response.Title }},
    {{ .Ident "folder" | .Into .Response.Folder }},
    {{ .Ident "subresource" | .Into .Response.Subresource }},
    {{ .Ident "content" | .Into .Response.Content }},
    {{ .Ident "metadata" | .Into .Response.Metadata }},
    {{ .Ident "rank" | .Into .Response.Rank }}
    FROM (
    SELECT DISTINCT ON ({{ .Ident "uid" }})
        {{ .Ident "uid" }},
        {{ .Ident "title" }},
        COALESCE({{ .Ident "folder" }}, '') AS {{ .Ident "folder" }},
        {{ .Ident "subresource" }},
        {{ .Ident "content" }},
        {{ .Ident "metadata" }},
        ts_rank_cd({{ .Ident "ts" }}, websearch_to_tsquery('english', {{ .Arg .Query }})) AS {{ .Ident "rank" }}
    FROM embeddings
    WHERE {{ .Ident "resource" }}  = {{ .Arg .Resource }}
    AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND {{ .Ident "model" }}     = {{ .Arg .Model }}
    AND {{ .Ident "ts" }} @@ websearch_to_tsquery('english', {{ .Arg .Query }})
    AND websearch_to_tsquery('english', {{ .Arg .Query }})::text ~ '(^|[ (&|])'''
    {{ if .UIDFilter }}
    AND {{ .Ident "uid" }} IN ({{ .ArgList .UIDFilterSlice }})
    {{ end }}
    {{ if .FolderFilter }}
    AND {{ .Ident "folder" }} IN ({{ .ArgList .FolderFilterSlice }})
    {{ end }}
    {{ range .MetadataFilterGroups }}
    AND ({{ range $i, $j := .JSONs }}{{ if $i }} OR {{ end }}{{ $.Ident "metadata" }} @> {{ $.Arg $j }}{{ end }})
    {{ end }}
    ORDER BY {{ .Ident "uid" }}, {{ .Ident "rank" }} DESC
    ) AS best
    WHERE {{ .Ident "rank" }} > 0
    ORDER BY {{ .Ident "rank" }} DESC, {{ .Ident "uid" }} ASC
    LIMIT {{ .Arg .Limit }}
;
