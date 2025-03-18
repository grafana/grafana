export enum FieldExtractorID {
  JSON = 'json',
  KeyValues = 'kvp',
  Auto = 'auto',
  RegExp = 'regexp',
  Delimiter = 'delimiter',
}

export interface JSONPath {
  path: string;
  alias?: string;
}
export interface ExtractFieldsOptions {
  source?: string;
  jsonPaths?: JSONPath[];
  delimiter?: string;
  regExp?: string;
  format?: FieldExtractorID;
  replace?: boolean;
  keepTime?: boolean;
}
