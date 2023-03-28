export interface ScopedVar<T = any> {
  text?: any;
  value: T;
  [key: string]: any;
}

export interface ScopedVars extends Record<string, ScopedVar> {}
