UPDATE {{ .Ident "resource_history" }}
SET {{ .Ident "resource_version" }} = (
    CASE
    {{ range $guid, $rv := .GUIDToRV }}
    WHEN {{ $.Ident "guid" }} = {{ $.Arg $guid }} THEN CAST({{ $.Arg $rv }} AS {{ if eq $.DialectName "postgres" }}BIGINT{{ else }}SIGNED{{ end }})
    {{ end }}
    END
), {{ .Ident "key_path" }} = (
    CASE
    {{ range $guid, $rv := .GUIDToRV }}
    WHEN {{ $.Ident "guid" }} = {{ $.Arg $guid }} THEN CONCAT(
      'unified', CHAR(47), 'data', CHAR(47),
      {{ $.Ident "group" }}, CHAR(47),
      {{ $.Ident "resource" }}, CHAR(47),
      {{ $.Ident "namespace" }}, CHAR(47),
      {{ $.Ident "name" }}, CHAR(47),
      CAST((((({{ $.Arg $rv }} / 1000) - 1288834974657) << 22) + ({{ $.Arg $rv }} % 1000 )) AS {{ if eq $.DialectName "postgres" }}BIGINT{{ else }}SIGNED{{ end }}), CHAR(126),
      CASE {{ $.Ident "action" }}
        WHEN 1 THEN 'created'
        WHEN 2 THEN 'updated'
        WHEN 3 THEN 'deleted'
      END, CHAR(126),
      COALESCE({{ $.Ident "folder" }}, ''))
    {{ end }}
    END
)
WHERE {{ .Ident "guid" }} IN (
    {{$first := true}}
    {{ range $guid, $rv := .GUIDToRV }}{{if $first}}{{$first = false}}{{else}}, {{end}}{{ $.Arg $guid }}{{ end }}
);
