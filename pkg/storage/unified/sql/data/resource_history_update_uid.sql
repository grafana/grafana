UPDATE {{ .Ident "resource_history" }}
    SET {{ .Ident "value" }} = REPLACE({{ .Ident "value" }}, CONCAT('"uid":"', {{ .Arg .OldUID }}, '"'), CONCAT('"uid":"', {{ .Arg .NewUID }}, '"'))
    WHERE {{ .Ident "name" }} = {{ .Arg .WriteEvent.Key.Name }}
    AND {{ .Ident "namespace" }} = {{ .Arg .WriteEvent.Key.Namespace }}
    AND {{ .Ident "group" }}     = {{ .Arg .WriteEvent.Key.Group }}
    AND {{ .Ident "resource" }}  = {{ .Arg .WriteEvent.Key.Resource }}
    AND {{ .Ident "action" }} != 3
    AND {{ .Ident "value" }} NOT LIKE '%deletionTimestamp%';
