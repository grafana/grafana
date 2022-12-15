-- add unique index cache_data.cache_key
CREATE UNIQUE INDEX "UQE_cache_data_cache_key" ON "cache_data" ("cache_key");
-- add index team_member.team_id
CREATE INDEX "IDX_team_member_team_id" ON "team_member" ("team_id");
