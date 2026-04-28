import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Alert, LinkButton } from '@grafana/ui';

import { useFolderReadme } from '../../hooks/useFolderReadme';

interface Props {
  folderUID: string;
  folderUrl: string;
}

/**
 * Info banner shown above the dashboards list on a provisioned folder. Links
 * to the dedicated README tab. Only rendered when the provisioningReadmes
 * feature is on and a README exists.
 */
export function FolderReadmeHint({ folderUID, folderUrl }: Props) {
  const { repository, isRepoLoading, isFileLoading, isError, fileData } = useFolderReadme(folderUID);

  if (!config.featureToggles.provisioningReadmes) {
    return null;
  }

  if (!repository || isRepoLoading || isFileLoading || isError || !fileData) {
    return null;
  }

  return (
    <Alert
      severity="info"
      topSpacing={1}
      bottomSpacing={1}
      title={t('browse-dashboards.readme.hint-title', 'New to this folder?')}
      action={
        <LinkButton
          variant="secondary"
          fill="outline"
          href={`${folderUrl}/readme`}
          onClick={() => {
            reportInteraction('grafana_provisioning_readme_hint_clicked', {
              repositoryType: repository.type,
            });
          }}
        >
          <Trans i18nKey="browse-dashboards.readme.hint-action">See details</Trans>
        </LinkButton>
      }
    >
      <Trans i18nKey="browse-dashboards.readme.hint-body">
        The README explains how this folder is organized and where to find the dashboards you need.
      </Trans>
    </Alert>
  );
}
