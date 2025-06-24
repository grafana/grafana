INSERT INTO {{ .Ident "secret_audit_log_config" }} (
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
{{ if .Row.FilePath.Valid }}
  {{ .Ident "file_path" }},
{{ end }}
{{ if .Row.FileMaxFileSizeMB.Valid }}
  {{ .Ident "file_max_file_size_mb" }},
{{ end }}
{{ if .Row.FileMaxFiles.Valid }}
  {{ .Ident "file_max_files" }},
{{ end }} 
{{ if .Row.LokiURLSecureValueName.Valid }}
  {{ .Ident "loki_url_secure_value_name" }},
{{ end }}
{{ if .Row.LokiProtocol.Valid }}
  {{ .Ident "loki_protocol" }},
{{ end }}
{{ if .Row.LokiTLS.Valid }}
  {{ .Ident "loki_tls" }},
{{ end }}
  {{ .Ident "loki_enable" }}
) VALUES (
  {{ .Arg .Row.GUID }},
  {{ .Arg .Row.Name }},
  {{ .Arg .Row.Namespace }},
  {{ .Arg .Row.Annotations }},
  {{ .Arg .Row.Labels }},
  {{ .Arg .Row.Created }},
  {{ .Arg .Row.CreatedBy }},
  {{ .Arg .Row.Updated }},
  {{ .Arg .Row.UpdatedBy }},
  {{ .Arg .Row.StdoutEnable }},
  {{ .Arg .Row.FileEnable }},
{{ if .Row.FilePath.Valid }}
  {{ .Arg .Row.FilePath.String }},
{{ end }}
{{ if .Row.FileMaxFileSizeMB.Valid }}
  {{ .Arg .Row.FileMaxFileSizeMB.Int32 }},
{{ end }}
{{ if .Row.FileMaxFiles.Valid }}
  {{ .Arg .Row.FileMaxFiles.Int32 }},
{{ end }}
{{ if .Row.LokiURLSecureValueName.Valid }}
  {{ .Arg .Row.LokiURLSecureValueName.String }},
{{ end }}
{{ if .Row.LokiProtocol.Valid }}
  {{ .Arg .Row.LokiProtocol.String }},
{{ end }}
{{ if .Row.LokiTLS.Valid }}
  {{ .Arg .Row.LokiTLS.Bool }},
{{ end }}
  {{ .Arg .Row.LokiEnable }}
);
