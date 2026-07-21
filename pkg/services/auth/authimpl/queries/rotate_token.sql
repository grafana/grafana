UPDATE {{ .Ident .TokenTable }} SET
  {{ .Ident "seen_at" }} = {{ .Arg 0 }},
  {{ .Ident "user_agent" }} = {{ .Arg .UserAgent }},
  {{ .Ident "client_ip" }} = {{ .Arg .ClientIP }},
  {{ .Ident "prev_auth_token" }} = {{ .Ident "auth_token" }},
  {{ .Ident "auth_token" }} = {{ .Arg .HashedToken }},
  {{ .Ident "auth_token_seen" }} = {{ .Arg false }},
  {{ .Ident "rotated_at" }} = {{ .Arg .RotatedAt }}
WHERE {{ .Ident "id" }} = {{ .Arg .TokenID }};
