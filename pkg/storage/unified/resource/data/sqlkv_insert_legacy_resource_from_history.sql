INSERT INTO {{ .Ident "resource" }}
SELECT
  kv.{{ .Ident "guid" }},
  kv.{{ .Ident "resource_version" }},
  kv.{{ .Ident "group" }},
  kv.{{ .Ident "resource" }},
  kv.{{ .Ident "namespace" }},
  kv.{{ .Ident "name" }},
  kv.{{ .Ident "value" }},
  kv.{{ .Ident "action" }},
  kv.{{ .Ident "label_set" }},
  kv.{{ .Ident "previous_resource_version" }},
  kv.{{ .Ident "folder" }}
FROM {{ .Ident "resource_history" }} AS kv
  INNER JOIN (
    SELECT {{ .Ident "namespace" }}, {{ .Ident "group" }}, {{ .Ident "resource" }}, {{ .Ident "name" }}, max({{ .Ident "resource_version" }}) AS {{ .Ident "resource_version" }}
    FROM {{ .Ident "resource_history" }} AS mkv
    WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
      AND {{ .Ident "group" }}     = {{ .Arg .Group }}
      AND {{ .Ident "resource" }}  = {{ .Arg .Resource }}
    GROUP BY mkv.{{ .Ident "namespace" }}, mkv.{{ .Ident "group" }}, mkv.{{ .Ident "resource" }}, mkv.{{ .Ident "name" }}
  ) AS maxkv
       ON maxkv.{{ .Ident "resource_version" }} = kv.{{ .Ident "resource_version" }}
      AND maxkv.{{ .Ident "namespace" }} = kv.{{ .Ident "namespace" }}
      AND maxkv.{{ .Ident "group" }}     = kv.{{ .Ident "group" }}
      AND maxkv.{{ .Ident "resource" }}  = kv.{{ .Ident "resource" }}
      AND maxkv.{{ .Ident "name" }}      = kv.{{ .Ident "name" }}
WHERE kv.{{ .Ident "action" }} != 3
  AND kv.{{ .Ident "namespace" }} = {{ .Arg .Namespace }}
  AND kv.{{ .Ident "group" }}     = {{ .Arg .Group }}
  AND kv.{{ .Ident "resource" }}  = {{ .Arg .Resource }}
ORDER BY kv.{{ .Ident "resource_version" }} ASC;
