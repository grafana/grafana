SELECT
    dashboard.org_id, dashboard.id,
    dashboard.uid, dashboard.folder_uid,
    dashboard.deleted, plugin_id,
    provisioning.name         as origin_name,
    provisioning.external_id  as origin_path,
    provisioning.check_sum    as origin_key,
    provisioning.updated      as origin_ts,
    dashboard.created, created_user.uid as created_by, dashboard.created_by   as created_by_id,
    dashboard.updated, updated_user.uid as updated_by, dashboard.updated_by   as updated_by_id,
    dashboard.version, '' as message, dashboard.data
    FROM `grafana`.`dashboard` as dashboard
    LEFT OUTER JOIN `grafana`.`dashboard_provisioning` as provisioning ON dashboard.id = provisioning.dashboard_id
    LEFT OUTER JOIN `grafana`.`user` as created_user ON dashboard.created_by = created_user.id
    LEFT OUTER JOIN `grafana`.`user` as updated_user ON dashboard.updated_by = updated_user.id
    WHERE dashboard.is_folder = false
      AND dashboard.org_id = 2
      AND dashboard.uid = 'UUU'
      AND dashboard.deleted IS NULL
    ORDER BY dashboard.id DESC
