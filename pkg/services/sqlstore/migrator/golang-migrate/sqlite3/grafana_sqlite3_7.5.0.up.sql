-- Add revoked_at to the user auth token
ALTER TABLE `user_auth_token` ADD COLUMN `revoked_at` INTEGER NULL;
