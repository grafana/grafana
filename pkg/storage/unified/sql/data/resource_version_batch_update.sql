UPDATE {{ .Ident "resource_version" }}
SET
    {{ .Ident "resource_version" }} = {{ .Arg .ResourceVersion }}
WHERE 1 = 1
    AND {{ .Ident "group" }}    = {{ .Arg .Group }}
    AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
    AND {{ .Ident "shard" }} IN (
        {{ range $index, $element := .Shards }}{{ if $index }}, {{ end }}{{ .Arg $element }}{{ end }}
    ) 
;
