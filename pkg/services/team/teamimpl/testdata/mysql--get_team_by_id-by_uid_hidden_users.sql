SELECT
  team.id as id,
  team.uid,
  team.org_id,
  team.name as name,
  team.email as email,
  team.external_uid as external_uid,
  team.is_provisioned as is_provisioned,
  (SELECT COUNT(*) FROM `test_schema`.`team_member`
    INNER JOIN `test_schema`.`user` ON team_member.user_id = `user`.id
    WHERE team_member.team_id = team.id AND `user`.login NOT IN (?)) AS member_count
FROM `test_schema`.`team` as team
WHERE team.org_id = ? and team.uid = ?
