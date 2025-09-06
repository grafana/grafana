import { t } from '@grafana/i18n';
import { Stack, Text } from '@grafana/ui';

import { Target } from './types';

export function BootstrapStepResourceCounting({
  target,
  fileCountString,
  resourceCountString,
}: {
  target: Target;
  fileCountString: string;
  resourceCountString: string;
}) {
  if (target === 'instance') {
    return (
      <Stack direction="row" gap={3}>
        <div>
          {t('provisioning.bootstrap-step.external-storage-label', 'External storage')}{' '}
          <Text color="primary">{fileCountString}</Text>
        </div>
        <div>
          {t('provisioning.bootstrap-step.unmanaged-resources-label', 'Unmanaged resources')}{' '}
          <Text color="primary">{resourceCountString}</Text>
        </div>
      </Stack>
    );
  }

  if (target === 'folder') {
    return (
      <div>
        {t('provisioning.bootstrap-step.external-storage-label', 'External storage')}{' '}
        <Text color="primary">{fileCountString}</Text>
      </div>
    );
  }

  return null;
}
