SELECT dashboard.id
FROM {{ .Ident .DashboardTable }} as dashboard
WHERE dashboard.is_folder = {{ .Arg .Query.GetFolders }}
  AND dashboard.org_id = {{ .Arg .Query.OrgID }}
  AND dashboard.id >= {{ .Arg .Query.AfterID }}
ORDER BY dashboard.id ASC
LIMIT {{ .Arg .Limit }}
