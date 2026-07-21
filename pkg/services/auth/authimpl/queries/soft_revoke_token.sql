UPDATE {{ .Ident .TokenTable }} SET
  {{- $sep := "" -}}
  {{- if ne .Token.UserId 0 }}{{ $sep }} {{ .Ident "user_id" }} = {{ .Arg .Token.UserId }}{{ $sep = "," }}{{ end -}}
  {{- if ne .Token.AuthToken "" }}{{ $sep }} {{ .Ident "auth_token" }} = {{ .Arg .Token.AuthToken }}{{ $sep = "," }}{{ end -}}
  {{- if ne .Token.PrevAuthToken "" }}{{ $sep }} {{ .Ident "prev_auth_token" }} = {{ .Arg .Token.PrevAuthToken }}{{ $sep = "," }}{{ end -}}
  {{- if ne .Token.UserAgent "" }}{{ $sep }} {{ .Ident "user_agent" }} = {{ .Arg .Token.UserAgent }}{{ $sep = "," }}{{ end -}}
  {{- if ne .Token.ClientIp "" }}{{ $sep }} {{ .Ident "client_ip" }} = {{ .Arg .Token.ClientIp }}{{ $sep = "," }}{{ end -}}
  {{- if .Token.AuthTokenSeen }}{{ $sep }} {{ .Ident "auth_token_seen" }} = {{ .Arg .Token.AuthTokenSeen }}{{ $sep = "," }}{{ end -}}
  {{- if ne .Token.SeenAt 0 }}{{ $sep }} {{ .Ident "seen_at" }} = {{ .Arg .Token.SeenAt }}{{ $sep = "," }}{{ end -}}
  {{- if ne .Token.RotatedAt 0 }}{{ $sep }} {{ .Ident "rotated_at" }} = {{ .Arg .Token.RotatedAt }}{{ $sep = "," }}{{ end -}}
  {{- if ne .Token.CreatedAt 0 }}{{ $sep }} {{ .Ident "created_at" }} = {{ .Arg .Token.CreatedAt }}{{ $sep = "," }}{{ end -}}
  {{- if ne .Token.UpdatedAt 0 }}{{ $sep }} {{ .Ident "updated_at" }} = {{ .Arg .Token.UpdatedAt }}{{ $sep = "," }}{{ end -}}
  {{- if ne .Token.RevokedAt 0 }}{{ $sep }} {{ .Ident "revoked_at" }} = {{ .Arg .Token.RevokedAt }}{{ $sep = "," }}{{ end -}}
  {{- if ne .Token.ExternalSessionId 0 }}{{ $sep }} {{ .Ident "external_session_id" }} = {{ .Arg .Token.ExternalSessionId }}{{ end }}
WHERE {{ .Ident "id" }} = {{ .Arg .Token.Id }};
