import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

interface Props {
  noRepository: boolean;
  isReadOnlyRepo: boolean;
  readOnlyMessage?: string;
}

export function RepoInvalidStateBanner({ noRepository, isReadOnlyRepo, readOnlyMessage }: Props) {
  if (noRepository) {
    return (
      <Alert
        title={t('browse-dashboards.bulk-move-resources-form.error.repository-not-found-title', 'Repository not found')}
      >
        <Trans i18nKey="browse-dashboards.bulk-move-resources-form.error.repository-not-found-message">
          The repository for the selected folder could not be found. Please ensure that the folder is provisioned
          correctly.
        </Trans>
      </Alert>
    );
  }

  if (isReadOnlyRepo) {
    return (
      <Alert
        title={t('browse-dashboards.bulk-move-resources-form.error.read-only-title', 'This repository is read only')}
      >
        {readOnlyMessage
          ? t(
              'browse-dashboards.bulk-move-resources-form.error.read-only-saving-message',
              'Repository is read-only. {{readOnlyMessage}}',
              { readOnlyMessage }
            )
          : t(
              'browse-dashboards.bulk-move-resources-form.error.read-only-message',
              'If you have direct access to the target, please make modifications directly in the target repository.'
            )}
      </Alert>
    );
  }

  return null;
}
