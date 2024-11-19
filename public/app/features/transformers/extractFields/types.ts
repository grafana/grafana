export enum FieldExtractorID {
  JSON = 'json',
  KeyValues = 'kvp',
  Auto = 'auto',
  RegExp = 'regexp',
}

export interface JSONPath {
  path: string;
  alias?: string;
}
export interface ExtractFieldsOptions {
  source?: string;
  jsonPaths?: JSONPath[];
  regExp?: string;
  format?: FieldExtractorID;
  replace?: boolean;
  keepTime?: boolean;
}
