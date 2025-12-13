import { Trans } from '@grafana/i18n';
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
  return (
    <Stack direction="row" gap={3}>
      <Stack gap={1}>
        <Trans i18nKey="provisioning.bootstrap-step.external-storage-label">External storage</Trans>
        <Text color="primary">{fileCountString}</Text>
      </Stack>
      <Stack gap={1}>
        <Trans i18nKey="provisioning.bootstrap-step.unmanaged-resources-label">Unmanaged resources</Trans>{' '}
        <Text color="primary">{resourceCountString}</Text>
      </Stack>
    </Stack>
  );
}
