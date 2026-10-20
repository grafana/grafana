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
    FROM `test_schema`.`team_member` AS team_member
    WHERE team_member.team_id = team.id
    ) AS member_count
FROM `test_schema`.`team` AS team
WHERE team.org_id = 7
ORDER BY
team.name ASC
