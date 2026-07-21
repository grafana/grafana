UPDATE {{ .Ident .TokenTable }} SET
  {{ .Ident "user_id" }} = {{ .Arg .Token.UserId }},
  {{ .Ident "auth_token" }} = {{ .Arg .Token.AuthToken }},
  {{ .Ident "prev_auth_token" }} = {{ .Arg .Token.PrevAuthToken }},
  {{ .Ident "user_agent" }} = {{ .Arg .Token.UserAgent }},
  {{ .Ident "client_ip" }} = {{ .Arg .Token.ClientIp }},
  {{ .Ident "auth_token_seen" }} = {{ .Arg .Token.AuthTokenSeen }},
  {{ .Ident "seen_at" }} = {{ .Arg .Token.SeenAt }},
  {{ .Ident "rotated_at" }} = {{ .Arg .Token.RotatedAt }},
  {{ .Ident "created_at" }} = {{ .Arg .Token.CreatedAt }},
  {{ .Ident "updated_at" }} = {{ .Arg .Token.UpdatedAt }},
  {{ .Ident "revoked_at" }} = {{ .Arg .Token.RevokedAt }},
  {{ .Ident "external_session_id" }} = {{ .Arg .Token.ExternalSessionId }}
WHERE {{ .Ident "id" }} = {{ .Arg .Token.Id }} AND {{ if .Previous }}{{ .Ident "prev_auth_token" }} = {{ .Arg .ExpectedToken }} AND {{ .Ident "rotated_at" }} < {{ .Arg .Token.RotatedAt }}{{ else }}{{ .Ident "auth_token" }} = {{ .Arg .ExpectedToken }}{{ end }};
