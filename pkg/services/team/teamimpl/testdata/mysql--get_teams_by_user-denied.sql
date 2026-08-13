SELECT
  team.id AS id,
  team.uid,
  team.org_id,
  team.name AS name,
  team.email AS email,
  team.external_uid AS external_uid,
  team.is_provisioned AS is_provisioned,
  (
    SELECT COUNT(*)
    FROM `test_schema`.`team_member` AS member_count_team_member
    WHERE member_count_team_member.team_id = team.id
  ) AS member_count
FROM `test_schema`.`team` AS team
INNER JOIN `test_schema`.`team_member` AS team_member ON team.id = team_member.team_id
WHERE team.org_id = 7
  AND team_member.user_id = 42
AND 1 = 0
