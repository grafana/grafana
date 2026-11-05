SELECT uid FROM {{ .Ident .ReportTable }} WHERE id = {{ .Arg .ReportID }} AND org_id = {{ .Arg .OrgID }}
