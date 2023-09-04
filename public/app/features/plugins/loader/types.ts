// Extend the System type with the loader hooks we use
// to provide backwards compatibility with older version of Systemjs
export type SystemJSWithLoaderHooks = typeof System & {
  shouldFetch: () => Boolean;
  fetch: (url: string, options?: Record<string, unknown>) => Promise<Response>;
  onload: (err: unknown, id: string) => void;
};
