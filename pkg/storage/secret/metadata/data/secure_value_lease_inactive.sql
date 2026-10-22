UPDATE
  {{ .Ident "secret_secure_value" }}
SET
  {{ .Ident "lease_token" }} = {{ .Arg .LeaseToken }},
  {{ .Ident "lease_created" }} = {{ .Arg .Now }},
  {{ .Ident "lease_duration" }} = ({{ .Arg .LeaseTTL }} * POWER(2, {{ .Ident "gc_attempts" }}))
WHERE
  {{ .Ident "guid" }} IN ({{ .ArgList .SecureValueIDs }}) AND
  {{ .Ident "active" }} = FALSE AND
  {{ .Arg .Now }} - {{ .Ident "lease_created" }} > {{ .Ident "lease_duration" }}
;
