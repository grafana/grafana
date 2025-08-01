SELECT COUNT(*) AS count
FROM
  {{ .Ident "secret_encrypted_value" }}
{{ if .HasUntilTime }}
WHERE {{ .Ident "created" }} <= {{ .Arg .UntilTime }}
{{ end }}
;
