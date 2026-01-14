/**
 * Represents the kind/source of a notification template.
 * Grafana templates are native, while Mimir templates come from external sources.
 */
export enum TemplateKind {
  Grafana = 'grafana',
  Mimir = 'mimir',
}
