export interface BaseProvisionedFormData {
  ref?: string;
  path: string;
  comment?: string;
  repo: string;
  title: string;
}

export interface ProvisionedDashboardFormData extends BaseProvisionedFormData {
  description: string;
  folder: {
    uid?: string;
    title?: string;
  };
  copyTags?: boolean;
  /** Pre-fills the provider's "open pull request" form when the commit creates a branch. */
  prDescription?: string;
}
