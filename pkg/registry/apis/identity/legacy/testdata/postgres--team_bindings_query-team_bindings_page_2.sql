SELECT tm.id as id, t.uid as team_uid, t.id as team_id, u.uid as user_uid, tm.created, tm.updated, tm.permission
FROM "grafana"."team_member" tm
INNER JOIN "grafana"."team" t ON tm.team_id = t.id
INNER JOIN "grafana"."user" u ON tm.user_id  = u.id
WHERE
    t.uid IN(
      SELECT uid
      FROM "grafana"."team" t
        WHERE t.id >= 2
      ORDER BY t.id ASC LIMIT 1
    )
AND tm.org_id = 1
AND NOT tm.external
ORDER BY t.id ASC;
