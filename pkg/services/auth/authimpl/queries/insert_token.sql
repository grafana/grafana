INSERT INTO {{ .Ident .TokenTable }} (
  {{ .Ident "user_id" }}, {{ .Ident "auth_token" }}, {{ .Ident "prev_auth_token" }},
  {{ .Ident "user_agent" }}, {{ .Ident "client_ip" }}, {{ .Ident "auth_token_seen" }},
  {{ .Ident "seen_at" }}, {{ .Ident "rotated_at" }}, {{ .Ident "created_at" }},
  {{ .Ident "updated_at" }}, {{ .Ident "revoked_at" }}, {{ .Ident "external_session_id" }}
) VALUES (
  {{ .Arg .Token.UserId }}, {{ .Arg .Token.AuthToken }}, {{ .Arg .Token.PrevAuthToken }},
  {{ .Arg .Token.UserAgent }}, {{ .Arg .Token.ClientIp }}, {{ .Arg .Token.AuthTokenSeen }},
  {{ .Arg .Token.SeenAt }}, {{ .Arg .Token.RotatedAt }}, {{ .Arg .Token.CreatedAt }},
  {{ .Arg .Token.UpdatedAt }}, {{ .Arg .Token.RevokedAt }}, {{ .Arg .Token.ExternalSessionId }}
){{ if eq .DialectName "postgres" }} RETURNING {{ .Ident "id" }}{{ end }};
