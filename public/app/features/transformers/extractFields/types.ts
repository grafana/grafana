export enum FieldExtractorID {
  JSON = 'json',
  KeyValues = 'kvp',
  Regex = 'regex',
  Auto = 'auto',
}

export interface JSONPath {
  path: string;
  alias?: string;
}
export interface ExtractFieldsOptions {
  source?: string;
  jsonPaths?: JSONPath[];
  expression?: string;
  format?: FieldExtractorID;
  replace?: boolean;
  keepTime?: boolean;
}
