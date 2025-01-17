UPDATE {{ .Ident "resource_history" }}
   SET {{ .Ident "value" }} = {{ .Arg .Value }}
 WHERE {{ .Ident "guid"  }} = {{ .Arg .GUID }}
;
