import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Button, Stack } from '@grafana/ui';

import { PROVISIONING_URL } from '../../constants';

interface MissingFolderMetadataBannerProps {
  folderUID?: string;
}

/**
 * SPIKE: Banner shown on provisioned folder pages when the folder is missing
 * a .folder.json metadata file. Provides a direct "Fix" action and a link
 * to the repository status page.
 */
export function MissingFolderMetadataBanner({ folderUID }: MissingFolderMetadataBannerProps) {
  const [isFixing, setIsFixing] = useState(false);
  const provisioningEnabled = config.featureToggles.provisioning;

  if (!provisioningEnabled || !folderUID) {
    return null;
  }

  // SPIKE: In a real implementation this would check the API for missing metadata.
  // For the spike, we show the banner on all provisioned folders to demonstrate the UI.
  const hasMissingMetadata = true;

  if (!hasMissingMetadata) {
    return null;
  }

  const handleFix = () => {
    setIsFixing(true);
    // SPIKE: Simulate creating a PR job
    setTimeout(() => setIsFixing(false), 2000);
  };

  return (
    <Alert
      severity="warning"
      title={t(
        'provisioning.folder-metadata-banner.title',
        'This folder is missing a .folder.json metadata file'
      )}
    >
      <Stack direction="row" alignItems="center" gap={2}>
        <span>
          <Trans i18nKey="provisioning.folder-metadata-banner.description">
            Without a metadata file, this folder may lose its identity (UID and permissions) when re-synced. Fix this by
            creating a PR that adds the missing metadata file.
          </Trans>
        </span>
        <Stack direction="row" gap={1}>
          <Button variant="secondary" icon="wrench" onClick={handleFix} disabled={isFixing} size="sm">
            {isFixing ? (
              <Trans i18nKey="provisioning.folder-metadata-banner.fixing">Fixing...</Trans>
            ) : (
              <Trans i18nKey="provisioning.folder-metadata-banner.fix">Fix folder ID</Trans>
            )}
          </Button>
          <Button
            variant="secondary"
            icon="external-link-alt"
            size="sm"
            onClick={() => {
              window.location.href = `${PROVISIONING_URL}/${folderUID}?tab=resources`;
            }}
          >
            <Trans i18nKey="provisioning.folder-metadata-banner.view-resources">View in Resources</Trans>
          </Button>
        </Stack>
      </Stack>
    </Alert>
  );
}
