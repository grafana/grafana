DELETE FROM {{ .Ident "resource_last_import_time" }}
WHERE {{ .Ident "last_import_time" }} <= {{ .Arg .Threshold }}
;
