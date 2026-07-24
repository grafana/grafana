SELECT id
FROM {{ .Ident .UserAuthTable }}
WHERE user_id = {{ .Arg .UserID }}
  AND auth_module = {{ .Arg .AuthModule }}
  AND auth_id = {{ .Arg .AuthID }}
