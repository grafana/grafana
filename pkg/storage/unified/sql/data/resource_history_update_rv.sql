UPDATE {{ .Ident "resource_history" }}
    SET {{ .Ident "resource_version" }} = {{ .Arg .ResourceVersion }}
    WHERE  {{ .Ident "guid" }} = {{ .Arg .GUID }}
;
