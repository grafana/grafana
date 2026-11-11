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
}
