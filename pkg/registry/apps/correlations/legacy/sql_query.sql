SELECT c.uid,c.org_id,c.{{ .Ident "type" }},c.config,c.description,c.label,c.provisioned,
 src.{{ .Ident "type" }} as src_type, src.uid as src_uid,
 tgt.{{ .Ident "type" }} as tgt_type, tgt.uid as tgt_uid
 FROM {{ .Ident .CorrelationTable }} AS c
 LEFT JOIN {{ .Ident .DataSourceTable }} AS src ON c.source_uid = src.uid
 LEFT JOIN {{ .Ident .DataSourceTable }} AS tgt ON c.target_uid = tgt.uid
WHERE c.org_id={{ .Arg .OrgID }}
{{ if .CorrelationUID }}
   AND c.uid = {{ .Arg .CorrelationUID }}
{{ end }}
{{ if .SourceUIDs }}
   AND src.uid IN ({{ .ArgList .SourceUIDs }})
{{ end }}