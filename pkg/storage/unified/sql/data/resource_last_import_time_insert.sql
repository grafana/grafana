{{ if eq $.DialectName "mysql" }}
  INSERT INTO {{ .Ident "resource_last_import_time" }} (
      {{ .Ident "group" }},
      {{ .Ident "resource" }},
      {{ .Ident "namespace" }},
      {{ .Ident "last_import_time" }}
    ) VALUES (
      {{ .Arg .Group }},
      {{ .Arg .Resource }},
      {{ .Arg .Namespace }},
      {{ if .UseDatabaseTime }}UTC_TIMESTAMP(){{ else }}{{ .Arg .LastImportTime }}{{ end }}
    ) ON DUPLICATE KEY UPDATE {{ .Ident "last_import_time" }} = {{ if .UseDatabaseTime }}UTC_TIMESTAMP(){{ else }}{{ .Arg .LastImportTime }}{{ end }}

{{ else if eq $.DialectName "sqlite" }}
   INSERT OR REPLACE INTO {{ .Ident "resource_last_import_time" }} (
       {{ .Ident "group" }},
       {{ .Ident "resource" }},
       {{ .Ident "namespace" }},
       {{ .Ident "last_import_time" }}
   ) VALUES (
       {{ .Arg .Group }},
       {{ .Arg .Resource }},
       {{ .Arg .Namespace }},
       {{ if .UseDatabaseTime }}strftime({{ .Arg "%Y-%m-%d %H:%M:%S+00:00" }}, 'now'){{ else }}{{ .Arg .LastImportTime }}{{ end }}
   )

{{ else if eq $.DialectName "postgres" }}
    INSERT INTO {{ .Ident "resource_last_import_time" }} (
       {{ .Ident "group" }},
       {{ .Ident "resource" }},
       {{ .Ident "namespace" }},
       {{ .Ident "last_import_time" }}
     ) VALUES (
       {{ .Arg .Group }},
       {{ .Arg .Resource }},
       {{ .Arg .Namespace }},
       {{ if .UseDatabaseTime }}date_trunc('second', clock_timestamp() AT TIME ZONE 'UTC'){{ else }}{{ .Arg .LastImportTime }}{{ end }}
    ) ON CONFLICT ({{ .Ident "group" }}, {{ .Ident "resource" }}, {{ .Ident "namespace" }})
      DO UPDATE SET {{ .Ident "last_import_time" }} = {{ if .UseDatabaseTime }}date_trunc('second', clock_timestamp() AT TIME ZONE 'UTC'){{ else }}{{ .Arg .LastImportTime }}{{ end }}

{{ end }}
;
