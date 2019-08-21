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
export interface LinkModel {
  href: string;
  title: string;
  target: LinkTarget;
}
