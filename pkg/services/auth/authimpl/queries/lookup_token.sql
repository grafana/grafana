SELECT {{ .TokenColumns }}
FROM {{ .Ident .TokenTable }}
WHERE ({{ .Ident "auth_token" }} = {{ .Arg .HashedToken }} OR {{ .Ident "prev_auth_token" }} = {{ .Arg .HashedToken }});
