DELETE FROM {{ .Ident .TokenTable }} WHERE {{ .Ident "created_at" }} <= {{ .Arg .CreatedBefore }} OR {{ .Ident "rotated_at" }} <= {{ .Arg .RotatedBefore }};
