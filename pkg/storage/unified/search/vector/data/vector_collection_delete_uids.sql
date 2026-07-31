DELETE FROM embeddings
    WHERE {{ .Ident "resource" }}  = {{ .Arg .Resource }}
    AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    {{ if not .AllModels }}AND {{ .Ident "model" }} = {{ .Arg .Model }}{{ end }}
    AND {{ .Ident "uid" }}       IN ({{ .ArgList .UIDsSlice }})
;
