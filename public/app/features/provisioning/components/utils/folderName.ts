import { t } from '@grafana/i18n';

export function validateProvisionedFolderName(folderName: string): string | true {
  if (!folderName || typeof folderName !== 'string') {
    return t('browse-dashboards.new-provisioned-folder-form.error-required', 'Folder name is required');
  }

  // Backend allows: a-zA-Z0-9 _- (no dots, no forward slash for folder names)
  const invalidCharRegex = /[^a-zA-Z0-9 _-]/;

  if (invalidCharRegex.test(folderName)) {
    return t(
      'browse-dashboards.new-provisioned-folder-form.error-invalid-characters',
      'Folder name contains invalid characters. Only letters, numbers, spaces, underscores, and hyphens are allowed.'
    );
  }

  return true; // Valid
}
