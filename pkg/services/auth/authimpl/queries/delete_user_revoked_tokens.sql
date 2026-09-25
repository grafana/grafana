DELETE FROM {{ .Ident .TokenTable }}
WHERE user_id = {{ .Arg .UserID }}
  AND revoked_at > 0
  AND revoked_at <= {{ .Arg .RevokedBefore }}
