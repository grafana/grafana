export interface DuplicateKeyCheckOptions {
  failOnConflict?: boolean;
  conflictThreshold?: number;
  ignoreKeys?: string[];
}

export interface Occurrence {
  value: string;
  file: string;
}
