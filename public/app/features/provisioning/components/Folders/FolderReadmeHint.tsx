import { Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Icon, Stack, Text, TextLink } from '@grafana/ui';

import { useFolderReadme } from '../../hooks/useFolderReadme';

import { FOLDER_README_ANCHOR_ID } from './FolderReadmePanel';

interface Props {
  folderUID: string;
}

/**
 * Compact one-line hint above the dashboards list that scrolls down to the
 * inline README panel. Only shown when a README exists; the panel itself
 * carries the "Add README" empty-state when one doesn't.
 */
export function FolderReadmeHint({ folderUID }: Props) {
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
          Looking for an overview of this folder?{' '}
          <TextLink
            inline
            href={`#${FOLDER_README_ANCHOR_ID}`}
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
