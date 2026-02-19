package v0alpha1

TemplateKind:  *"grafana" | "mimir"

TemplateGroupSpec: {
	title:   string
	content: string
	kind:    TemplateKind
}
