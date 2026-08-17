UPDATE {{ .Ident .UserTable }}
SET
{{ if .Email -}}
  email = {{ .Arg .Email }},
{{ end -}}
{{ if .Name -}}
  name = {{ .Arg .Name }},
{{ end -}}
{{ if .Login -}}
  login = {{ .Arg .Login }},
{{ end -}}
{{ if .Password -}}
  password = {{ .Arg .Password }},
{{ end -}}
{{ if .HasEmailVerified -}}
  email_verified = {{ .Arg .EmailVerified }},
{{ end -}}
{{ if .Theme -}}
  theme = {{ .Arg .Theme }},
{{ end -}}
{{ if .HasIsDisabled -}}
  is_disabled = {{ .Arg .IsDisabled }},
{{ end -}}
{{ if .HasIsGrafanaAdmin -}}
  is_admin = {{ .Arg .IsGrafanaAdmin }},
{{ end -}}
{{ if .HasOrgID -}}
  org_id = {{ .Arg .OrgID }},
{{ end -}}
{{ if .HasIsProvisioned -}}
  is_provisioned = {{ .Arg .IsProvisioned }},
{{ end -}}
  updated = {{ .Arg .Updated }}
WHERE id = {{ .Arg .UserID }}
  AND is_service_account = {{ .Arg .IsServiceAccount }}
