SELECT
  dashboard.org_id, dashboard.id,
  dashboard.uid, dashboard.folder_uid,
  dashboard.deleted, plugin_id,
  provisioning.name        as repo_name,
  provisioning.external_id as repo_path,
  provisioning.check_sum   as repo_hash,
  provisioning.updated     as repo_ts,
  dashboard.created, created_user.uid as created_by, dashboard.created_by   as created_by_id,
  dashboard_version.created, updated_user.uid as updated_by,updated_user.id as created_by_id,
  dashboard_version.version, dashboard_version.message, dashboard_version.data
FROM "grafana"."dashboard" as dashboard
LEFT OUTER JOIN "grafana"."dashboard_version" as dashboard_version ON dashboard.id = dashboard_version.dashboard_id
LEFT OUTER JOIN "grafana"."dashboard_provisioning" as provisioning ON dashboard.id = provisioning.dashboard_id
LEFT OUTER JOIN "grafana"."user" as created_user ON dashboard.created_by = created_user.id
LEFT OUTER JOIN "grafana"."user" as updated_user ON dashboard.updated_by = updated_user.id
WHERE dashboard.is_folder = FALSE
  AND dashboard.org_id = 2
  AND dashboard.uid = 'UUU'
  AND dashboard_version.version = 3
  ORDER BY 
    dashboard_version.created ASC,
    dashboard_version.version ASC,
    dashboard.uid ASC
