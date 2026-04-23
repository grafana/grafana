DELETE FROM {{ .Table }}
    WHERE {{ .Ident "name" }} = {{ .Arg .Name }}
    AND {{ .Ident "subresource" }} IN ({{ .ArgList .SubresourcesSlice }})
;
