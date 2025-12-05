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
      'unified', {{ $.SlashFunc }}, 'data', {{ $.SlashFunc }},
      {{ $.Ident "group" }}, {{ $.SlashFunc }},
      {{ $.Ident "resource" }}, {{ $.SlashFunc }},
      {{ $.Ident "namespace" }}, {{ $.SlashFunc }},
      {{ $.Ident "name" }}, {{ $.SlashFunc }},
      CAST(((({{ if eq $.DialectName "postgres" }}(CAST({{ $.Arg $rv }} AS BIGINT) / 1000)::BIGINT{{ else if eq $.DialectName "mysql" }}(CAST({{ $.Arg $rv }} AS SIGNED) DIV 1000){{ else }}(CAST({{ $.Arg $rv }} AS SIGNED) / 1000){{ end }} - 1288834974657) << 22) + (CAST({{ $.Arg $rv }} AS {{ if eq $.DialectName "postgres" }}BIGINT{{ else }}SIGNED{{ end }}) % 1000 )) AS {{ if eq $.DialectName "postgres" }}BIGINT{{ else }}SIGNED{{ end }}),
      {{ $.TildeFunc }},
      CASE {{ $.Ident "action" }}
        WHEN 1 THEN 'created'
        WHEN 2 THEN 'updated'
        WHEN 3 THEN 'deleted'
      END, {{ $.TildeFunc }},
      COALESCE({{ $.Ident "folder" }}, ''))
    {{ end }}
    END
)
WHERE {{ .Ident "guid" }} IN (
    {{$first := true}}
    {{ range $guid, $rv := .GUIDToRV }}{{if $first}}{{$first = false}}{{else}}, {{end}}{{ $.Arg $guid }}{{ end }}
);
