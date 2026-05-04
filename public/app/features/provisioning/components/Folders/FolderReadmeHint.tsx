import { Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Icon, Stack, Text, TextLink } from '@grafana/ui';

import { useFolderReadme } from '../../hooks/useFolderReadme';

interface Props {
  folderUID: string;
  folderUrl: string;
}

/**
 * Inline one-line hint shown above the dashboards list on a provisioned
 * folder. Points users at the README tab without taking up banner-sized
 * space. Only rendered when the provisioningReadmes feature is on and a
 * README has loaded successfully.
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
    <Stack direction="row" alignItems="center" gap={1}>
      <Icon name="info-circle" size="sm" />
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="browse-dashboards.readme.hint">
          Looking for an overview of this folder?{' '}
          <TextLink
            inline
            href={`${folderUrl}/readme`}
            onClick={() => {
              reportInteraction('grafana_provisioning_readme_hint_clicked', {
                repositoryType: repository.type,
              });
            }}
          >
            See the README
          </TextLink>
        </Trans>
      </Text>
    </Stack>
  );
}
