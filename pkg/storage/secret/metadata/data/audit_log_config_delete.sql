DELETE FROM {{ .Ident "secret_audit_log_config" }}
WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
;
