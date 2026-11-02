// Extend the System type with the loader hooks we use
// to provide backwards compatibility with older version of Systemjs

export type SystemJSRegistration = [dependencies: string[], declare: System.DeclareFn, metadata?: unknown[]];

export type SystemJSWithLoaderHooks = typeof System & {
  shouldFetch: (url: string) => Boolean;
  fetch: (url: string, options?: Record<string, unknown>) => Promise<Response>;
  instantiate: (
    url: string,
    firstParentUrl?: string,
    meta?: unknown
  ) => SystemJSRegistration | Promise<SystemJSRegistration | undefined> | undefined;
  onload: (err: unknown, id: string) => void;
};
