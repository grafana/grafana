export enum FieldExtractorID {
  JSON = 'json',
  KeyValues = 'kvp',
  Auto = 'auto',
}

export interface JSONPath {
  path: string;
  alias?: string;
}

export interface SourceField {
  source?: string;
  jsonPaths?: JSONPath[];
  format?: FieldExtractorID;
}

export interface ExtractFieldsOptions {
  sources?: SourceField[];
  replace?: boolean;
  keepTime?: boolean;
}
