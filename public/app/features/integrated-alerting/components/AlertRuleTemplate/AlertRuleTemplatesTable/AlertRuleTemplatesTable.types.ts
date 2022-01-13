export enum SourceDescription {
  BUILT_IN = 'Built-in',
  SAAS = 'Percona Enterprise Platform',
  USER_FILE = 'User-defined (file)',
  USER_API = 'User-defined (UI)',
}

export interface Template {
  summary: string;
  source: keyof typeof SourceDescription;
  created_at: string;
}

export interface FormattedTemplate {
  summary: string;
  source: SourceDescription[keyof SourceDescription];
  created_at: string;
}
