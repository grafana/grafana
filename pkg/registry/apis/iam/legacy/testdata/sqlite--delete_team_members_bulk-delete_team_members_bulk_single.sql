DELETE FROM "grafana"."team_member"
WHERE org_id = 1
  AND uid IN ('team-member-1')
