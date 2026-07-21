UPDATE {{ .Ident .UserAuthTable }}
SET {{ if .AuthID }}auth_id = {{ .Arg .AuthID }},
    {{ end }}{{ if .ExternalUID }}external_uid = {{ .Arg .ExternalUID }},
    {{ end }}created = {{ .Arg .Created }},
    o_auth_expiry = {{ .Arg .OAuthExpiry }},
    o_auth_access_token = {{ .Arg .OAuthAccessToken }},
    o_auth_refresh_token = {{ .Arg .OAuthRefreshToken }},
    o_auth_id_token = {{ .Arg .OAuthIDToken }},
    o_auth_token_type = {{ .Arg .OAuthTokenType }}
WHERE user_id = {{ .Arg .UserID }}
  AND auth_module = {{ .Arg .AuthModule }}
