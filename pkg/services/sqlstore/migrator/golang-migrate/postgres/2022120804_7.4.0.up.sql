-- add index short_url.org_id-uid
CREATE UNIQUE INDEX "UQE_short_url_org_id_uid" ON "short_url" ("org_id","uid");
-- delete tags for deleted dashboards
DELETE FROM dashboard_tag WHERE dashboard_id NOT IN (SELECT id FROM dashboard)
-- delete stars for deleted dashboards
DELETE FROM star WHERE dashboard_id NOT IN (SELECT id FROM dashboard)
-- add unique index datasource_org_id_is_default
CREATE INDEX "IDX_data_source_org_id_is_default" ON "data_source" ("org_id","is_default");
-- Change dashboard_encrypted column to MEDIUMBLOB
SELECT 0;
-- drop index UQE_alert_rule_tag_alert_id_tag_id - v1
DROP INDEX "UQE_alert_rule_tag_alert_id_tag_id" CASCADE
-- Rename table alert_rule_tag to alert_rule_tag_v1 - v1
ALTER TABLE "alert_rule_tag" RENAME TO "alert_rule_tag_v1"
-- Create alert_rule_tag table v2
CREATE TABLE IF NOT EXISTS "alert_rule_tag" ( "id" SERIAL PRIMARY KEY  NOT NULL , "alert_id" BIGINT NOT NULL , "tag_id" BIGINT NOT NULL );
-- create index UQE_alert_rule_tag_alert_id_tag_id - Add unique index alert_rule_tag.alert_id_tag_id V2
CREATE UNIQUE INDEX "UQE_alert_rule_tag_alert_id_tag_id" ON "alert_rule_tag" ("alert_id","tag_id");
-- copy alert_rule_tag v1 to v2
INSERT INTO "alert_rule_tag" ("alert_id" , "tag_id") SELECT "alert_id" , "tag_id" FROM "alert_rule_tag_v1"
-- drop table alert_rule_tag_v1
DROP TABLE IF EXISTS "alert_rule_tag_v1"
-- drop index UQE_annotation_tag_annotation_id_tag_id - v2
DROP INDEX "UQE_annotation_tag_annotation_id_tag_id" CASCADE
-- Rename table annotation_tag to annotation_tag_v2 - v2
ALTER TABLE "annotation_tag" RENAME TO "annotation_tag_v2"
-- Create annotation_tag table v3
CREATE TABLE IF NOT EXISTS "annotation_tag" ( "id" SERIAL PRIMARY KEY  NOT NULL , "annotation_id" BIGINT NOT NULL , "tag_id" BIGINT NOT NULL );
-- create index UQE_annotation_tag_annotation_id_tag_id - Add unique index annotation_tag.annotation_id_tag_id V3
CREATE UNIQUE INDEX "UQE_annotation_tag_annotation_id_tag_id" ON "annotation_tag" ("annotation_id","tag_id");
-- copy annotation_tag v2 to v3
INSERT INTO "annotation_tag" ("annotation_id" , "tag_id") SELECT "annotation_id" , "tag_id" FROM "annotation_tag_v2"
-- drop table annotation_tag_v2
DROP TABLE IF EXISTS "annotation_tag_v2"
-- delete acl rules for deleted dashboards and folders
DELETE FROM dashboard_acl WHERE dashboard_id NOT IN (SELECT id FROM dashboard) AND dashboard_id != -1
