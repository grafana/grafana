DELETE FROM {{ .Ident .ExternalSessionTable }}
WHERE NOT EXISTS (
  SELECT 1 FROM {{ .Ident .TokenTable }} AS {{ .Ident "token" }}
  WHERE {{ .Ident .ExternalSessionIDColumn }} = {{ .Ident .TokenExternalSessionIDColumn }}
);
