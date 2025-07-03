SELECT
  {{ .Ident "guid" }},
  {{ .Ident "name" }},
  {{ .Ident "namespace" }},
  {{ .Ident "annotations" }},
  {{ .Ident "labels" }},
  {{ .Ident "created" }},
  {{ .Ident "created_by" }},
  {{ .Ident "updated" }},
  {{ .Ident "updated_by" }},
  {{ .Ident "stdout_enable" }},
  {{ .Ident "file_enable" }},
  {{ .Ident "file_path" }},
  {{ .Ident "file_max_file_size_mb" }},
  {{ .Ident "file_max_files" }},
  {{ .Ident "loki_enable" }},
  {{ .Ident "loki_url_secure_value_name" }},
  {{ .Ident "loki_protocol" }},
  {{ .Ident "loki_tls" }}
FROM
  {{ .Ident "secret_audit_log_config" }}
WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
LIMIT 1
;
