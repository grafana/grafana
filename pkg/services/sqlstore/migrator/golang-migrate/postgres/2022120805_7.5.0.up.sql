-- delete acl rules for deleted dashboards and folders
DELETE FROM dashboard_acl WHERE dashboard_id NOT IN (SELECT id FROM dashboard) AND dashboard_id != -1
-- Add revoked_at to the user auth token
alter table "user_auth_token" ADD COLUMN "revoked_at" INTEGER NULL
