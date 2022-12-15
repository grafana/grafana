-- add index team_member.team_id
CREATE INDEX "IDX_team_member_team_id" ON "team_member" ("team_id");
-- Add column secure_settings in alert_notification
alter table "alert_notification" ADD COLUMN "secure_settings" TEXT NULL
-- alter alert.settings to mediumtext
SELECT 0;
