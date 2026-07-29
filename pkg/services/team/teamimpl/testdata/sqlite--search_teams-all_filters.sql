SELECT
  team.id as id,
  team.uid,
  team.org_id,
  team.name as name,
  team.email as email,
  team.external_uid as external_uid,
  team.is_provisioned as is_provisioned,
  (SELECT COUNT(*) FROM "test_schema"."team_member" WHERE team_member.team_id = team.id) AS member_count
FROM "test_schema"."team" as team
WHERE team.org_id = ? and team.name LIKE ? and LOWER(team.name) = LOWER(?) and team.id IN (?, ?) and team.uid IN (?, ?)
 and team.id IN (?, ?)
 order by team.name asc LIMIT 10 OFFSET 0
