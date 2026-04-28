import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Alert, Button, Stack } from '@grafana/ui';

import { useFolderReadme } from '../../hooks/useFolderReadme';

import { RenderedReadme } from './RenderedReadme';

interface Props {
  folderUID: string;
  /** Unused now that the hint expands inline; kept for API compatibility. */
  folderUrl?: string;
}

/**
 * Info banner shown above the dashboards list on a provisioned folder. Lets
 * the user expand the README markdown inline without leaving the page. Only
 * rendered when the provisioningReadmes feature is on and a README exists.
 */
export function FolderReadmeHint({ folderUID }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { repository, isRepoLoading, isFileLoading, isError, fileData } = useFolderReadme(folderUID);

  if (!config.featureToggles.provisioningReadmes) {
    return null;
  }

  if (!repository || isRepoLoading || isFileLoading || isError || !fileData) {
    return null;
  }

  const handleToggle = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (next) {
      reportInteraction('grafana_provisioning_readme_hint_expanded', {
        repositoryType: repository.type,
      });
    }
  };

  return (
    <Alert
      severity="info"
      topSpacing={1}
      bottomSpacing={1}
      title={t('browse-dashboards.readme.hint-title', 'New to this folder?')}
    >
      <Stack direction="column" gap={2}>
        <Trans i18nKey="browse-dashboards.readme.hint-body">
          The README explains how this folder is organized and where to find the dashboards you need.
        </Trans>
        <div>
          <Button
            variant="secondary"
            fill="text"
            icon={isExpanded ? 'angle-up' : 'angle-down'}
            onClick={handleToggle}
            aria-expanded={isExpanded}
          >
            {isExpanded
              ? t('browse-dashboards.readme.hide-details', 'Hide README')
              : t('browse-dashboards.readme.show-details', 'Show README')}
          </Button>
        </div>
        {isExpanded && <RenderedReadme file={fileData.resource?.file} />}
      </Stack>
    </Alert>
  );
}
