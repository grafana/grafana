
**What happened?**
{{ .WhatHappenedQuestion }}

**Environment:**
{{ if .InstanceSlug }}
- Slug: `{{ .InstanceSlug }}`
{{ end }}
{{ if .InstanceVersion }}
- Version: `{{ .InstanceVersion }}`
{{ end }}
{{ if .InstanceRunningVersion }}
- Running version: `{{ .InstanceRunningVersion }}`
{{ end }}
{{ if .BrowserName }}
- Browser: {{ .BrowserName }}
{{ end }}

{{ if .Datasources }}
<details>
<summary>Datasources</summary>

| Name | Type | Version |
|------------------|-----------------|-----------------|
{{- range .Datasources }}
| {{ .Name }} | {{ .Type }} | {{ .Version }} |
{{- end }}

</details>
{{- end }}

{{ if .Plugins }}
<details>
<summary>Plugins</summary>

| Name | Version | Build Date |
|------------------|-----------------|-----------------|
{{- range .Plugins }}
| {{ .Name }} | {{ .Version }} | {{ .BuildDate }} |
{{- end }}
</details>
{{- end }}

{{ if .FeatureToggles }}
<details>

<summary>Feature toggles</summary>

| Name |
|------------------|
{{- range .FeatureToggles }}
| {{ . }} |
{{- end }}

</details>
{{- end }}

**Screenshot:**
{{.SnapshotURL}}
