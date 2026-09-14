DELETE FROM {{ .Ident .TokenTable }}
WHERE created_at <= {{ .Arg .CreatedBefore }}
   OR seen_at <= {{ .Arg .SeenBefore }}
