import { Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Icon, Stack, Text, TextLink } from '@grafana/ui';

import { useFolderReadme } from '../../hooks/useFolderReadme';

import { FOLDER_README_ANCHOR_ID } from './FolderReadmePanel';

/** Show the hint only when the dashboards list is long enough that the user
 * is unlikely to scroll past it to discover the README on their own. */
export const FOLDER_README_HINT_MIN_ITEMS = 20;

interface Props {
  folderUID: string;
  /** Number of items currently visible in the dashboards list. */
  itemCount: number;
}

/**
 * Compact one-line hint above the dashboards list that scrolls down to the
 * inline README panel via a same-page anchor. Shown only when
 *   - the provisioningReadmes feature is on,
 *   - a README has loaded successfully for the folder, and
 *   - the dashboards list is long enough (>= FOLDER_README_HINT_MIN_ITEMS)
 *     that the README would otherwise be off-screen at the bottom.
 */
export function FolderReadmeHint({ folderUID, itemCount }: Props) {
  const { repository, isRepoLoading, isFileLoading, isError, fileData } = useFolderReadme(folderUID);

  if (!config.featureToggles.provisioningReadmes) {
    return null;
  }

  if (!repository || isRepoLoading || isFileLoading || isError || !fileData) {
    return null;
  }

  if (itemCount < FOLDER_README_HINT_MIN_ITEMS) {
    return null;
  }

  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Icon name="info-circle" size="sm" />
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="browse-dashboards.readme.hint">
          Lots of dashboards or new to this folder?{' '}
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
