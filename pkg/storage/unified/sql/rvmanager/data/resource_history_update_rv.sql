UPDATE {{ .Ident "resource_history" }}
SET {{ .Ident "resource_version" }} = (
    CASE
    {{ range $guid, $rv := .GUIDToRV }}
    WHEN {{ $.Ident "guid" }} = {{ $.Arg $guid }} THEN CAST({{ $.Arg $rv }} AS {{ if eq $.DialectName "postgres" }}BIGINT{{ else }}SIGNED{{ end }})
    {{ end }}
    END
), {{ .Ident "key_path" }} = (
    CASE
    {{ range $guid, $snowflakeRv := .GUIDToSnowflakeRV }}
    WHEN {{ $.Ident "guid" }} = {{ $.Arg $guid }} THEN CONCAT(
      'unified', {{ $.SlashFunc }}, 'data', {{ $.SlashFunc }},
      {{ $.Ident "group" }}, {{ $.SlashFunc }},
      {{ $.Ident "resource" }}, {{ $.SlashFunc }},
      CASE WHEN {{ $.Ident "namespace" }} = '' THEN '' ELSE CONCAT({{ $.Ident "namespace" }}, {{ $.SlashFunc }}) END,
      {{ $.Ident "name" }}, {{ $.SlashFunc }},
      CAST({{ $.Arg $snowflakeRv }} AS {{ if eq $.DialectName "postgres" }}BIGINT{{ else }}SIGNED{{ end }}),
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
