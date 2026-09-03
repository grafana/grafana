UPDATE {{ .Ident .UserTable }}
SET is_disabled = {{ .Arg .IsDisabled }}
WHERE id IN ({{ .ArgList .UserIDs }})
  AND is_service_account = FALSE
