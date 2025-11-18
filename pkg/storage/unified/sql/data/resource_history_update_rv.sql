UPDATE {{ .Ident "resource_history" }}
SET 
    {{ .Ident "resource_version" }} = (
    CASE
    {{ range $guid, $rv := .GUIDToRV }}
    WHEN {{ $.Ident "guid" }} = {{ $.Arg $guid }} THEN CAST({{ $.Arg $rv }} AS {{ if eq $.DialectName "postgres" }}BIGINT{{ else }}SIGNED{{ end }})
    {{ end }}
    END
    ),
    {{ .Ident "key_path" }} = {{ if eq .DialectName "sqlite" -}}
        {{ .Ident "group" }} || CHAR(47) || {{ .Ident "resource" }} || CHAR(47) || {{ .Ident "namespace" }} || CHAR(47) || {{ .Ident "name" }} || CHAR(47) ||
            CAST((CASE
                {{- range $guid, $rv := .GUIDToRV }}
                WHEN {{ $.Ident "guid" }} = {{ $.Arg $guid }} THEN ((({{ $.Arg $rv }} / 1000) - 1288834974657) * 4194304) + ({{ $.Arg $rv }} % 1000)
                {{- end }}
            END) AS TEXT) || CHAR(126) ||
            CASE {{ .Ident "action" }}
                WHEN 1 THEN 'created'
                WHEN 2 THEN 'updated'
                WHEN 3 THEN 'deleted'
                ELSE 'unknown'
            END || CHAR(126) || COALESCE({{ .Ident "folder" }}, '')
        {{- else -}}
        CONCAT(
            {{ .Ident "group" }}, CHAR(47),
            {{ .Ident "resource" }}, CHAR(47),
            {{ .Ident "namespace" }}, CHAR(47),
            {{ .Ident "name" }}, CHAR(47),
            CAST((CASE
                {{- range $guid, $rv := .GUIDToRV }}
                WHEN {{ $.Ident "guid" }} = {{ $.Arg $guid }} THEN ((({{ $.Arg $rv }} DIV 1000) - 1288834974657) * 4194304) + ({{ $.Arg $rv }} MOD 1000)
                {{- end }}
            END) AS {{ if eq .DialectName "postgres" }}TEXT{{ else }}CHAR{{ end }}), CHAR(126),
            CASE {{ .Ident "action" }}
                WHEN 1 THEN 'created'
                WHEN 2 THEN 'updated'
                WHEN 3 THEN 'deleted'
                ELSE 'unknown'
            END, CHAR(126),
            COALESCE({{ .Ident "folder" }}, '')
        )
        {{- end }}
WHERE {{ .Ident "guid" }} IN (
    {{$first := true}}
    {{ range $guid, $rv := .GUIDToRV }}{{if $first}}{{$first = false}}{{else}}, {{end}}{{ $.Arg $guid }}{{ end }}
);
