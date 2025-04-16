export interface ModifyActionConfig {
  type: 'modify';
  path: string;
  pattern: string;
  template?: string;
  templateFile?: string;
  data?: Record<string, unknown>;
}

export interface FormatFilesActionConfig {
  type: 'formatFiles';
  files: string[];
}

export interface RunGenerateApisActionConfig {
  type: 'runGenerateApis';
  isEnterprise: boolean;
}

// Union type of all possible action configs
export type ActionConfig = 
  | { type: 'add'; path: string; templateFile: string; data?: Record<string, unknown> }
  | ModifyActionConfig
  | FormatFilesActionConfig
  | RunGenerateApisActionConfig;

export interface PlopData {
  groupName: string;
  group: string;
  version: string;
  reducerPath: string;
  endpoints: string;
  isEnterprise: boolean;
}

export function isPlopData(data: unknown): data is Partial<PlopData> {
  return typeof data === 'object' && data !== null;
} 
