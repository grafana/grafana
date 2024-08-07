SELECT
    dashboard.org_id, dashboard.id,
    dashboard.uid, dashboard.folder_uid,
    dashboard.deleted, plugin_id,
    dashboard_provisioning.name         as origin_name,
    dashboard_provisioning.external_id  as origin_path,
    dashboard_provisioning.check_sum    as origin_key,
    dashboard_provisioning.updated      as origin_ts,
    dashboard.created, created_user.uid as created_by, dashboard.created_by   as created_by_id,
    {{ if .Query.UseHistoryTable }}
    dashboard_version.created, updated_user.uid as updated_by,updated_user.id as created_by_id,
    dashboard_version.version, dashboard_version.message, dashboard_version.data
    {{ else }}
    dashboard.updated, updated_user.uid as updated_by, dashboard.updated_by   as updated_by_id,
    dashboard.version, '' as message, dashboard.data
    {{ end }}
    FROM dashboard
    {{ if .Query.UseHistoryTable }}
    LEFT OUTER JOIN dashboard_version      ON dashboard.id = dashboard_version.dashboard_id
    {{ end }}
    LEFT OUTER JOIN dashboard_provisioning ON dashboard.id = dashboard_provisioning.dashboard_id
    LEFT OUTER JOIN {{ .Ident "user" }} AS created_user ON dashboard.created_by = created_user.id
    LEFT OUTER JOIN {{ .Ident "user" }} AS updated_user ON dashboard.updated_by = updated_user.id
    WHERE dashboard.is_folder = false
      AND dashboard.org_id = {{ .Arg .Query.OrgID }}
    {{ if .Query.UseHistoryTable }}
      {{ if .Query.Version }}
        AND dashboard_version.version = {{ .Arg .Query.Version }}
      {{ else if .Query.LastID }}
        AND dashboard_version.version < {{ .Arg .Query.LastID }}
      {{ end }}
    ORDER BY dashboard_version.version DESC
    {{ else }}
      {{ if .Query.UID }}
        AND dashboard.uid = {{ .Arg .Query.UID }}
      {{ else if .Query.LastID }}
        AND dashboard.id > {{ .Arg .Query.LastID }}
      {{ end }}
      {{ if .Query.GetTrash }}
        AND dashboard.deleted IS NOT NULL
      {{ else if .Query.LastID }}
        AND dashboard.deleted IS NULL
      {{ end }}
    ORDER BY dashboard.id DESC
    {{ end }}
