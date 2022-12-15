-- Add revoked_at to the user auth token
alter table `user_auth_token` ADD COLUMN `revoked_at` INT NULL
