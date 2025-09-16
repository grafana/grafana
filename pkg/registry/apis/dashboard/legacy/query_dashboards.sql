SELECT
  dashboard.org_id,
  dashboard.id,
  dashboard.uid,
  dashboard.title,
  dashboard.folder_uid,
  dashboard.deleted,
  plugin_id,
  provisioning.name        as repo_name,
  provisioning.external_id as repo_path,
  provisioning.check_sum   as repo_hash,
  provisioning.updated     as repo_ts,
  dashboard.created,
  created_user.uid         as created_by,
  dashboard.created_by     as created_by_id,
  {{ if .Query.UseHistoryTable }}
  {{ if and .Query.GetHistory (not .Query.AllowFallback) }}
  dashboard_version.created as updated,
  updated_user.uid       as updated_by,
  dashboard_version.created_by as updated_by_id,
  dashboard_version.version,
  dashboard_version.message,
  dashboard_version.data,
  dashboard_version.api_version
  {{ else }}
  COALESCE(dashboard_version.created, dashboard.updated) as updated,
  updated_user.uid       as updated_by,
  COALESCE(dashboard_version.created_by, dashboard.updated_by) as updated_by_id,
  COALESCE(dashboard_version.version, dashboard.version) as version,
  COALESCE(dashboard_version.message, '') as message,
  COALESCE(dashboard_version.data, dashboard.data) as data,
  COALESCE(dashboard_version.api_version, dashboard.api_version) as api_version
  {{ end }}
  {{ else }}
  dashboard.updated,
  updated_user.uid       as updated_by,
  dashboard.updated_by   as updated_by_id,
  dashboard.version,
  '' as message,
  dashboard.data,
  dashboard.api_version
  {{ end }}
FROM {{ .Ident .DashboardTable }} as dashboard
{{ if .Query.UseHistoryTable }}
LEFT OUTER JOIN {{ .Ident .VersionTable }} as dashboard_version ON dashboard.id = dashboard_version.dashboard_id
{{ end }}
LEFT OUTER JOIN {{ .Ident .ProvisioningTable }} as provisioning ON dashboard.id = provisioning.dashboard_id
LEFT OUTER JOIN {{ .Ident .UserTable }} as created_user ON dashboard.created_by = created_user.id
LEFT OUTER JOIN {{ .Ident .UserTable }} as updated_user ON {{ if .Query.UseHistoryTable }}{{ if and .Query.GetHistory (not .Query.AllowFallback) }}dashboard_version.created_by = updated_user.id{{ else }}COALESCE(dashboard_version.created_by, dashboard.updated_by) = updated_user.id{{ end }}{{ else }}dashboard.updated_by = updated_user.id{{ end }}
WHERE dashboard.is_folder = {{ .Arg .Query.GetFolders }}
  AND dashboard.org_id = {{ .Arg .Query.OrgID }}
  {{ if .Query.UseHistoryTable }}
  {{ if .Query.UID }}
  AND dashboard.uid = {{ .Arg .Query.UID }}
  {{ end }}
  {{ if .Query.Version }}
  AND dashboard_version.version = {{ .Arg .Query.Version }}
  {{ else if .Query.LastID }}
  {{ if and .Query.GetHistory (not .Query.AllowFallback) }}
  AND dashboard_version.version < {{ .Arg .Query.LastID }}
  {{ else }}
  AND COALESCE(dashboard_version.version, dashboard.version) < {{ .Arg .Query.LastID }}
  {{ end }}
  {{ end }}
  ORDER BY
    {{ if and .Query.GetHistory (not .Query.AllowFallback) }}
    dashboard_version.created {{ .Query.Order }},
    dashboard_version.version {{ .Query.Order }},
    {{ else }}
    COALESCE(dashboard_version.created, dashboard.updated) {{ .Query.Order }},
    COALESCE(dashboard_version.version, dashboard.version) {{ .Query.Order }},
    {{ end }}
    dashboard.uid ASC
  {{ else }}
  {{ if .Query.UID }}
  AND dashboard.uid = {{ .Arg .Query.UID }}
  {{ else if .Query.LastID }}
  AND dashboard.id < {{ .Arg .Query.LastID }}
  {{ end }}
  {{ if .Query.GetTrash }}
  AND dashboard.deleted IS NOT NULL
  {{ else }}
  AND dashboard.deleted IS NULL
  {{ end }}
  ORDER BY dashboard.id DESC
  {{ end }}
