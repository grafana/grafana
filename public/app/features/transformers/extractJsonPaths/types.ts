export interface JSONPath {
  path: string;
  alias?: string;
}

export interface SourceField {
  source: string;
  paths?: JSONPath[];
}

export interface ExtractJSONPathOptions {
  sources?: SourceField[];
  replace?: boolean;
  keepTime?: boolean;
}
