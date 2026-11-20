UPDATE {{ .Ident .TokenTable }}
SET
  seen_at = 0,
  user_agent = {{ .Arg .UserAgent }},
  client_ip = {{ .Arg .ClientIP }},
  prev_auth_token = auth_token,
  auth_token = {{ .Arg .AuthToken }},
  auth_token_seen = {{ .Arg .AuthTokenSeen }},
  rotated_at = {{ .Arg .RotatedAt }}
WHERE id = {{ .Arg .TokenID }}
