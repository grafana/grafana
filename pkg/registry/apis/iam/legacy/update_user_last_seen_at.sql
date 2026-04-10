-- name: update_user_last_seen_at
UPDATE {{ .Ident .UserTable }}
SET last_seen_at = {{ .Arg .Command.LastSeenAt }}
WHERE uid = {{ .Arg .Command.UID }}
