INSERT INTO {{ .Ident .ExternalSessionTable }} (
  {{ .Ident "user_id" }}, {{ .Ident "user_auth_id" }}, {{ .Ident "auth_module" }},
  {{ .Ident "access_token" }}, {{ .Ident "id_token" }}, {{ .Ident "refresh_token" }},
  {{ .Ident "session_id" }}, {{ .Ident "session_id_hash" }}, {{ .Ident "name_id" }},
  {{ .Ident "name_id_hash" }}, {{ .Ident "expires_at" }}, {{ .Ident "created_at" }}
) VALUES (
  {{ .Arg .Session.UserID }}, {{ .Arg .Session.UserAuthID }}, {{ .Arg .Session.AuthModule }},
  {{ .Arg .Session.AccessToken }}, {{ .Arg .Session.IDToken }}, {{ .Arg .Session.RefreshToken }},
  {{ .Arg .Session.SessionID }}, {{ .Arg .Session.SessionIDHash }}, {{ .Arg .Session.NameID }},
  {{ .Arg .Session.NameIDHash }}, {{ .Arg .ExpiresAt }}, {{ .Arg .CreatedAt }}
){{ if eq .DialectName "postgres" }} RETURNING {{ .Ident "id" }}{{ end }};
