SELECT {{ .TokenColumns }} FROM {{ .Ident .TokenTable }}
WHERE {{ .Ident "user_id" }} = {{ .Arg .UserID }} AND {{ .Ident "created_at" }} > {{ .Arg .CreatedAfter }} AND {{ .Ident "rotated_at" }} > {{ .Arg .RotatedAfter }} AND {{ .Ident "revoked_at" }} = {{ .Arg 0 }};
