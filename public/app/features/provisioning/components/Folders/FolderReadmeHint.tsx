import { Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Icon, Stack, Text, TextLink } from '@grafana/ui';

import { useFolderReadme } from '../../hooks/useFolderReadme';

interface Props {
  folderUID: string;
  folderUrl: string;
}

/**
 * Subtle one-line hint pointing users at the README tab when a provisioned folder
 * has a README.md available. Only shown when the provisioningReadmes feature is on.
 */
export function FolderReadmeHint({ folderUID, folderUrl }: Props) {
  const { repository, isRepoLoading, isFileLoading, isError, fileData } = useFolderReadme(folderUID);

  if (!config.featureToggles.provisioningReadmes) {
    return null;
  }

  // Only nudge users to a README that actually loaded successfully.
  if (!repository || isRepoLoading || isFileLoading || isError || !fileData) {
    return null;
  }

  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Icon name="info-circle" size="sm" />
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="browse-dashboards.readme.hint">
          Looking for a specific dashboard?{' '}
          <TextLink
            href={`${folderUrl}/readme`}
            inline
            onClick={() => {
              reportInteraction('grafana_provisioning_readme_hint_clicked', {
                repositoryType: repository.type,
              });
            }}
          >
            See the README
          </TextLink>
          .
        </Trans>
      </Text>
    </Stack>
  );
}
