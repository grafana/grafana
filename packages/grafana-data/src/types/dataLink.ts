/**
 * Link configuration.  The values may contain variables that need to be
 * processed before running
 */
export interface DataLink {
  url: string;
  title: string;
  targetBlank?: boolean;
}

export type LinkTarget = '_blank' | '_self';

/**
 * Processed Link Model.  The values are ready to use
 */
export interface LinkModel<T> {
  href: string;
  title: string;
  target: LinkTarget;
  origin: T;
}

/**
 * Provides a way to produce links on demand
 *
 * TODO: ScopedVars in in GrafanaUI package!
 */
export interface LinkModelSupplier<T extends object> {
  getLinks(scopedVars?: any): Array<LinkModel<T>>;
}
