SELECT COUNT(*) FROM {{ .Ident .TokenTable }}
WHERE {{ .Ident "created_at" }} > {{ .Arg .CreatedAfter }} AND {{ .Ident "rotated_at" }} > {{ .Arg .RotatedAfter }} AND {{ .Ident "revoked_at" }} = {{ .Arg 0 }}{{ if .HasUserID }} AND {{ .Ident "user_id" }} = {{ .Arg .UserID }}{{ end }};
