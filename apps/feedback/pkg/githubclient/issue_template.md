
**What happened?**
{{ .WhatHappenedQuestion }}

**Environment:**
- Instance: 
    - Slug: `{{ .InstanceSlug }}`
    - Version: `{{ .InstanceVersion }}`
    - Running version: `{{ .InstanceRunningVersion }}`
- Browser: `{{ .BrowserName }}`

<details>
<summary>Datasources</summary>

| Name | Type | Version |
|------------------|-----------------|-----------------|
{{- range .Datasources }}
| {{ .Name }} | {{ .Type }} | {{ .Version }} |
{{- end }}

</details>

<details>
<summary>Plugins</summary>

| Name | Version | Build Date |
|------------------|-----------------|-----------------|
{{- range .Plugins }}
| {{ .Name }} | {{ .Version }} | {{ .BuildDate }} |
{{- end }}
</details>


<details>

<summary>Feature toggles</summary>

| Name |
|------------------|
{{- range .FeatureToggles }}
| {{ . }} |
{{- end }}

</details>


**Screenshot:**
{{.SnapshotURL}}
