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

  // The name becomes both the directory name committed to the repository and the folder title.
  // The folder API trims the title it stores, so a surrounding space would leave the repository
  // path and Grafana permanently disagreeing about the name
  if (folderName !== folderName.trim()) {
    return t(
      'browse-dashboards.new-provisioned-folder-form.error-surrounding-space',
      'Folder name cannot start or end with a space.'
    );
  }

  return true; // Valid
}
