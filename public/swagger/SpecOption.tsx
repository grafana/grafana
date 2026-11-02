import { t } from '@grafana/i18n';
import { Badge, Stack, Text } from '@grafana/ui';

import { type APISpec } from './apiSpecs';

// SpecOption renders one entry of the API picker.
export function SpecOption({ spec }: { spec: APISpec }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between">
      <Text color={spec.superseded ? 'disabled' : undefined}>{spec.label}</Text>
      {spec.preferred && <Badge text={t('swagger.api-picker.preferred', 'Preferred')} color="blue" />}
    </Stack>
  );
}
