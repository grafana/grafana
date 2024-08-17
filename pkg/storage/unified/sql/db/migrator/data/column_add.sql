ALTER TABLE {{ .Ident .TableName }} ADD COLUMMN {{ .Ident .ColName }}
    {{ .ColType }}
    {{ if .ColNotNull }}NOT NULL{{ else }}NULL{{ end }}
    {{ if .ColHasDefault }}DEFAULT {{ $.Arg .ColDefault }}{{ end }}
