export interface ScopedVar<T = any> {
  text?: any;
  value: T;
  skipUrlSync?: boolean;
  skipFormat?: boolean;
}

export interface ScopedVars extends Record<string, ScopedVar> {}
