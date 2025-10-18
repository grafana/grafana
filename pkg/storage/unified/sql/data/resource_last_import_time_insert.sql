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
      {{ .Arg .LastImportTime }}
    ) ON DUPLICATE KEY UPDATE {{ .Ident "last_import_time" }} = {{ .Arg .LastImportTime }}

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
       {{ .Arg .LastImportTime }}
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
       {{ .Arg .LastImportTime }}
    ) ON CONFLICT ({{ .Ident "group" }}, {{ .Ident "resource" }}, {{ .Ident "namespace" }})
      DO UPDATE SET {{ .Ident "last_import_time" }} = {{ .Arg .LastImportTime }}

{{ end }}
;
