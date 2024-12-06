
**What happened?**
{{ .WhatHappenedQuestion }}

**Environment:**
{{- if .InstanceSlug }}
- Slug: `{{ .InstanceSlug }}`
{{- end }}
{{- if .InstanceVersion }}
- Version: `{{ .InstanceVersion }}`
{{- end }}
{{- if .InstanceRunningVersion }}
- Running version: `{{ .InstanceRunningVersion }}`
{{- end }}
{{- if .BrowserName }}
- Browser: `{{ .BrowserName }}`
{{- end }}
- Permission to access instance?: {{if .CanAccessInstance}} `Yes` {{else}} `No` {{end}} 
- Can contact issue reporter?: {{if .CanContactReporter}} `Yes` {{else}} `No` {{end}}
{{- if .CanContactReporter }}
- User Email: `{{ .UserEmail }}`
{{- end }}

{{- if .OpsDashboards }}
<details>
<summary>Debugging Dashboards</summary>

{{- range $name, $url := .OpsDashboards }}
- [{{ $name }}]({{ $url }})
{{- end }}

</details>
{{- end }}

{{- if .Datasources }}
<details>
<summary>Datasources</summary>

| Name | Type | Version |
|------------------|-----------------|-----------------|
{{- range .Datasources }}
| {{ .Name }} | {{ .Type }} | {{ .Version }} |
{{- end }}

</details>
{{- end }}

{{- if .Plugins }}
<details>
<summary>Plugins</summary>

| Name | Version | Build Date |
|------------------|-----------------|-----------------|
{{- range .Plugins }}
| {{ .Name }} | {{ .Version }} | {{ .BuildDate }} |
{{- end }}
</details>
{{- end }}

{{- if .FeatureToggles }}
<details>

<summary>Feature toggles</summary>

| Name |
|------------------|
{{- range .FeatureToggles }}
| {{ . }} |
{{- end }}

</details>
{{- end }}

{{- if .Configs }}
<details>
<summary>Configs</summary>

| Name | Enabled |
|------------------|-----------------|
{{- range .Configs }}
| {{ .Name }} | {{ .Enabled }} |
{{- end }}

</details>
{{- end }}


**Screenshot:**
{{.SnapshotURL}}
