SELECT {{ .TokenColumns }} FROM {{ .Ident .TokenTable }}
WHERE {{ .Ident "external_session_id" }} = {{ .Arg .ExternalSessionID }};
