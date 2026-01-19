import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';

import { ImportModel } from '../detect';

type Props = {
  model: ImportModel;
  onCancel: () => void;
};

export function ImportResourceFormatError({ model, onCancel }: Props) {
  const errorMessage =
    model === 'v1-resource'
      ? t(
          'manage-dashboards.import-resource-format-error.v1-message',
          'This dashboard is in Kubernetes v1 resource format and cannot be imported when Kubernetes dashboards feature is disabled. Please enable the kubernetesDashboards feature toggle to import this dashboard.'
        )
      : t(
          'manage-dashboards.import-resource-format-error.v2-message',
          'This dashboard is in v2 resource format and cannot be imported when Kubernetes dashboards feature is disabled. Please enable the kubernetesDashboards feature toggle to import this dashboard.'
        );

  return (
    <Stack direction="column" gap={2}>
      <Alert title={t('manage-dashboards.import-resource-format-error.title', 'Unsupported format')} severity="error">
        {errorMessage}
      </Alert>
      <Stack>
        <Button variant="secondary" onClick={onCancel}>
          <Trans i18nKey="manage-dashboards.import-resource-format-error.cancel">Cancel</Trans>
        </Button>
      </Stack>
    </Stack>
  );
}
