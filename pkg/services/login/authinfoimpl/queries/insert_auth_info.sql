INSERT INTO {{ .Ident .UserAuthTable }} (
  user_id,
  user_uid,
  auth_module,
  auth_id,
  created,
  o_auth_access_token,
  o_auth_refresh_token,
  o_auth_id_token,
  o_auth_token_type,
  o_auth_expiry,
  external_uid
)
VALUES (
  {{ .Arg .UserID }},
  {{ .Arg .UserUID }},
  {{ .Arg .AuthModule }},
  {{ .Arg .AuthID }},
  {{ .Arg .Created }},
  {{ .Arg .OAuthAccessToken }},
  {{ .Arg .OAuthRefreshToken }},
  {{ .Arg .OAuthIDToken }},
  {{ .Arg .OAuthTokenType }},
  {{ .Arg .OAuthExpiry }},
  {{ .Arg .ExternalUID }}
)
