UPDATE {{ .Ident .ExternalSessionTable }} SET
  {{ .Ident "access_token" }} = {{ .Arg .Session.AccessToken }},
  {{ .Ident "refresh_token" }} = {{ .Arg .Session.RefreshToken }},
  {{ .Ident "id_token" }} = {{ .Arg .Session.IDToken }},
  {{ .Ident "expires_at" }} = {{ .Arg .ExpiresAt }}
WHERE {{ .Ident "id" }} = {{ .Arg .ID }};
