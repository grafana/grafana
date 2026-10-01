DELETE FROM {{ .Ident .TokenTable }}
WHERE created_at <= {{ .Arg .CreatedBefore }}
   OR rotated_at <= {{ .Arg .RotatedBefore }}
