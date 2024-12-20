import { parseTemplates } from './utils';

describe('parseTemplates', () => {
  it('should parse basic template', () => {
    const templates = parseTemplates('{{ define "test" }}test{{ end }}');
    expect(templates).toEqual([{ name: 'test', content: '{{ define "test" }}test{{ end }}' }]);
  });

  it('should parse templates with multiple conditions', () => {
    const originalTemplate = `
{{ define "slack.title" }}{{ .CommonLabels.alertname -}}
  | [ACTIVE:{{ .Alerts.Firing | len }}{{ 
    if gt (.Alerts.Resolved | len) 0 }}, RESOLVED:{{ .Alerts.Resolved | len }}{{ end }}]  | CRI:{{.CommonLabels.criticality}} IMP:{{.CommonLabels.impact}} {{
      if eq .CommonLabels.impact "4"}}:warning:{{end}}{{
      if eq .CommonLabels.impact "5"}}:bangbang:{{end}}{{
      if  match "6|7|8" .CommonLabels.criticality}}:fire:{{end}}
{{ end -}}
    `.trim();

    const [template] = parseTemplates(originalTemplate);

    expect(template).toBeDefined();
    expect(template.name).toEqual('slack.title');
    expect(template.content).toBe(originalTemplate);
  });

  it('should parse templates with unusual formatting', () => {
    const originalTemplate = `
{{ define "slack.title.small" }}{{ .CommonLabels.alertname -}}
  {{
    if  match "6|7|8" .CommonLabels.criticality}}:fire:{{end}}
{{ end -}}`.trim();

    const [template] = parseTemplates(originalTemplate);

    expect(template).toBeDefined();
    expect(template.name).toEqual('slack.title.small');
    expect(template.content).toBe(originalTemplate);
  });

  it('should parse templates with nested templates', () => {
    const originalTemplate = `
{{ define "nested" }}
  Main Template Content
  {{ template "sub1" }}
  {{ template "sub2" }}
{{ end }}
{{ define "sub1" }}
  Sub Template 1 Content
{{ end }}
{{ define "sub2" }}
  Sub Template 2 Content
{{ end }}`.trim();

    const [template] = parseTemplates(originalTemplate);

    expect(template).toBeDefined();

    expect(template.name).toEqual('nested');
    expect(template.content).toBe(originalTemplate);
  });

  it('should parse multiple unrelated templates as separate ones', () => {
    const originalTemplate = `
{{ define "template1" }}template1{{ end }}
{{ define "template2" }}
  {{ .CommonLabels.alertname -}} 
{{ end }}
{{ define "template3" }}
  {{if eq .CommonLabels.impact "5"}}:bangbang:{{end}}
{{ end }}
    `.trim();

    const templates = parseTemplates(originalTemplate);

    expect(templates).toHaveLength(3);

    const [template1, template2, template3] = templates;

    expect(template1.name).toEqual('template1');
    expect(template2.name).toEqual('template2');
    expect(template3.name).toEqual('template3');

    expect(template1.content).toBe('{{ define "template1" }}template1{{ end }}');
    expect(template2.content).toBe(
      `
{{ define "template2" }}
  {{ .CommonLabels.alertname -}} 
{{ end }}`.trim()
    );
    expect(template3.content).toBe(
      `
{{ define "template3" }}
  {{if eq .CommonLabels.impact "5"}}:bangbang:{{end}}
{{ end }}`.trim()
    );
  });

  it('should parse mixed nested and non-nested templates', () => {
    const originalTemplate = `
{{ define "parent" }}
  {{ template "nested" }}
{{ end }}
{{ define "top-level" }}
  Top Level Template Content
{{ end }}
{{ define "nested" }}
  Nested Template Content
{{ end }}`.trim();

    const templates = parseTemplates(originalTemplate);

    expect(templates).toHaveLength(2);

    const [parent, topLevel] = templates;

    expect(parent.name).toEqual('parent');
    expect(topLevel.name).toEqual('top-level');

    expect(parent.content).toBe(
      `
{{ define "parent" }}
  {{ template "nested" }}
{{ end }}
{{ define "nested" }}
  Nested Template Content
{{ end }}`.trim()
    );
    expect(topLevel.content).toBe(
      `
{{ define "top-level" }}
  Top Level Template Content
{{ end }}`.trim()
    );
  });

  it('should handle templates with block definitions', () => {
    const template = `
{{ define "blocks" }}
{{ block "header" . }}
  default header
{{ end }}
{{ block "body" . }}
  default body
{{ end }}
{{ end }}`.trim();
    const [parsed] = parseTemplates(template);
    expect(parsed.content).toBe(template);
  });

  it('should handle templates with pipeline operations', () => {
    const template = `
{{ define "pipeline" }}
  {{ .Value | printf "%.2f" | quote }}
  {{ .Items | join "," | upper | trim }}
{{ end }}`.trim();
    const [parsed] = parseTemplates(template);
    expect(parsed.content).toBe(template);
  });

  it('should handle templates with variable declarations and scope', () => {
    const template = `
{{ define "variables" }}
  {{- $var1 := "value" -}}
  {{- with .Items -}}
    {{- $var2 := . -}}
    {{- range . -}}
      {{- $var3 := . -}}
    {{- end -}}
  {{- end -}}
{{ end }}`.trim();
    const [parsed] = parseTemplates(template);
    expect(parsed.content).toBe(template);
  });

  it('should handle templates with whitespace control modifiers', () => {
    const template = `
{{- define "whitespace" -}}
  {{- if .Value -}}
    has-value
  {{- else -}}
    no-value
  {{- end -}}
{{- end -}}`.trim();
    const [parsed] = parseTemplates(template);
    expect(parsed.content).toBe(template);
  });

  it('should handle templates with complex nested actions', () => {
    const template = `
{{ define "complex" }}
  {{- range $i, $v := .Items -}}
    {{- if not $v.Hidden -}}
      {{- with $v -}}
        {{- template "item" . -}}
      {{- end -}}
    {{- else -}}
      {{- /* skip hidden items */ -}}
    {{- end -}}
  {{- end -}}
{{ end }}`.trim();
    const [parsed] = parseTemplates(template);
    expect(parsed.content).toBe(template);
  });

  it('should handle templates with Go template comments', () => {
    const template = `
{{ define "comments" }}
  {{/* single-line comment */}}
  {{ printf "%q" "text" }}
  {{- /* 
    multi-line
    comment
  */ -}}
{{ end }}`.trim();
    const [parsed] = parseTemplates(template);
    expect(parsed.content).toBe(template);
  });

  it('should handle templates with function calls and method chaining', () => {
    const template = `
{{ define "functions" }}
  {{ call .Func .Arg1 .Arg2 }}
  {{ .Value.Method1.Method2 "arg" }}
  {{ index .Items 1 2 "key" }}
{{ end }}`.trim();
    const [parsed] = parseTemplates(template);
    expect(parsed.content).toBe(template);
  });

  it('should handle templates with complex boolean logic', () => {
    const template = `
{{ define "logic" }}
  {{- if and (not .Hidden) (or (gt .Value 100) (lt .Value 0)) (has .Flags "important") -}}
    special-case
  {{- end -}}
{{ end }}`.trim();
    const [parsed] = parseTemplates(template);
    expect(parsed.content).toBe(template);
  });
});
