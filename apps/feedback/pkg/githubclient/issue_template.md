
**What happened?**
{{ .WhatHappenedQuestion }}

**How do we reproduce it?:**
{{ .ReproduceQuestion }}

**Environment:**
- Instance: 
    - Slug: `{{ .InstanceSlug }}`
    - Version: `{{ .InstanceVersion }}`
    - Running version: `{{ .InstanceRunningVersion }}`
- Browser: `{{ .BrowserName }}`, version `{{ .BrowserVersion }}`
- Page: `{{ .PageURL }}`

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

| Name | Value |
|------------------|-----------------|
{{- range .FeatureToggles }}
| {{ .Name }} | {{ .Value }} |
{{- end }}

</details>


**Screenshot:**
![Screenshot]({{ .SnapshotURL }}?raw=true)
