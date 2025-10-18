DELETE FROM {{ .Ident .QueryHistoryStarsTable }}
 WHERE org_id = {{ .Arg .OrgID }} 
   AND user_id = {{ .Arg .UserID }} 
 {{ if .QueryUIDs }}
   AND query_uid IN ({{ .ArgList .QueryUIDs }})
{{ end }}