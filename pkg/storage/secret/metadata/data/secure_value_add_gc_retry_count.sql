UPDATE {{ .Ident "secret_secure_value" }}
SET {{ .Ident "gc_attempts" }} = {{ .Ident "gc_attempts" }} + 1
WHERE 
  {{ .Ident "guid" }} IN ({{ .ArgList .SecureValueIDs}}) AND
  {{ .Ident "active" }} = FALSE