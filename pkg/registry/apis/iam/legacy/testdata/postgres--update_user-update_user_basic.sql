-- name: update_user
UPDATE "grafana"."user"
SET
  login = 'newuser1',
  email = 'newuser1@example.com',
  name = 'New User One',
  is_admin = TRUE,
  is_disabled = TRUE,
  email_verified = FALSE,
  updated = '2023-01-01 13:00:00'
WHERE uid = 'user-1'
