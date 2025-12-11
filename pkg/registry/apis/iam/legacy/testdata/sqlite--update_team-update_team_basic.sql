UPDATE "grafana"."team"
SET name = 'Team 1',
    updated = '2023-01-01 12:00:00',
    email = 'team1@example.com',
    is_provisioned = TRUE,
    external_uid = 'team-1-uid'
WHERE uid = 'team-1'
