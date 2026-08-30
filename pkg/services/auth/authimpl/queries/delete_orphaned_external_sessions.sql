DELETE FROM {{ .Ident .ExternalSessionTable }}
WHERE NOT EXISTS (
  SELECT 1
  FROM {{ .Ident .TokenTable }}
  WHERE {{ .Ident .ExternalSessionTable }}.id = {{ .Ident .TokenTable }}.external_session_id
)
