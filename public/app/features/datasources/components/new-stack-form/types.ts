export interface TemplateSection {
  name: string;
  type: string;
}

export interface ModeSection {
  name: string;
  /** template name to selected datasource UID */
  datasources: Record<string, string>;
}

export interface StackFormValues {
  name: string;
  templates: TemplateSection[];
  modes: ModeSection[];
}
