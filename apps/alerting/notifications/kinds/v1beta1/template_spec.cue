package v1beta1

TemplateKind: *"grafana" | "mimir"

TemplateGroupSpec: {
	title:   string
	content: string
	kind:    TemplateKind
}
