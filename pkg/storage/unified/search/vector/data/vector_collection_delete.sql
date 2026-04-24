DELETE FROM {{ .Table }}
    WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND {{ .Ident "model" }}       = {{ .Arg .Model }}
    AND {{ .Ident "name" }}        = {{ .Arg .Name }}
;
