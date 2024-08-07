SELECT
    dashboard.org_id, dashboard.id,
    dashboard.uid, dashboard.folder_uid,
    dashboard.created,created_user.uid as created_by,
    dashboard_version.created,updated_user.uid as updated_by,
    dashboard.deleted, plugin_id,
    dashboard_provisioning.name as origin_name,
    dashboard_provisioning.external_id as origin_path,
    dashboard_provisioning.check_sum as origin_key,
    dashboard_provisioning.updated as origin_ts,
    dashboard_version.version, dashboard_version.message, dashboard_version.data
    FROM dashboard
    LEFT OUTER JOIN dashboard_version      ON dashboard.id = dashboard_version.dashboard_id
    LEFT OUTER JOIN dashboard_provisioning ON dashboard.id = dashboard_provisioning.dashboard_id
    LEFT OUTER JOIN {{ .Ident "user" }} AS created_user ON dashboard.created_by = created_user.id
    LEFT OUTER JOIN {{ .Ident "user" }} AS updated_user ON dashboard_version.created_by = updated_user.id
    WHERE dashboard.uid = {{ .Arg .Query.UID }}
	    AND dashboard.org_id = {{ .Arg .Query.OrgID }}
    {{ if .Query.Version }}
      AND dashboard_version.version = {{ .Arg .Query.Version }}
    {{ else if .Query.LastID }}
      AND dashboard_version.version < {{ .Arg .Query.LastID }}
    {{ end }}
    ORDER BY dashboard_version.version DESC
