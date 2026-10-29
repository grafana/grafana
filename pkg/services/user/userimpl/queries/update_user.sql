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
{{ if .PasswordValue -}}
  password = {{ .Arg .PasswordValue }},
{{ end -}}
{{ if .EmailVerified -}}
  email_verified = {{ .Arg .EmailVerifiedValue }},
{{ end -}}
{{ if .Theme -}}
  theme = {{ .Arg .Theme }},
{{ end -}}
{{ if .IsDisabled -}}
  is_disabled = {{ .Arg .IsDisabledValue }},
{{ end -}}
{{ if .IsGrafanaAdmin -}}
  is_admin = {{ .Arg .IsGrafanaAdminValue }},
{{ end -}}
{{ if .OrgID -}}
  org_id = {{ .Arg .OrgIDValue }},
{{ end -}}
{{ if .IsProvisioned -}}
  is_provisioned = {{ .Arg .IsProvisionedValue }},
{{ end -}}
  updated = {{ .Arg .Updated }}
WHERE id = {{ .Arg .UserID }}
  AND is_service_account = FALSE
