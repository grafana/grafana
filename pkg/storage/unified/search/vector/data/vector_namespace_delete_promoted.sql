DELETE FROM vector_promoted
    WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
;
