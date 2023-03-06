export enum FieldExtractorID {
  JSON = 'json',
  KeyValues = 'kvp',
  Auto = 'auto',
}

export interface JSONPath {
  path: string;
  alias?: string;
}
export interface ExtractFieldsOptions {
  source?: string;
  jsonPaths?: JSONPath[];
  format?: FieldExtractorID;
  replace?: boolean;
  keepTime?: boolean;
}
