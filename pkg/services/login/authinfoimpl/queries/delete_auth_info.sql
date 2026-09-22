DELETE FROM {{ .Ident .UserAuthTable }}
WHERE user_id = {{ .Arg .UserID }}
  AND auth_module = {{ .Arg .AuthModule }}
