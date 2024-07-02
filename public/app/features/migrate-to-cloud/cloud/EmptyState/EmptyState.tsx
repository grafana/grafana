import { Stack } from '@grafana/ui';

import { InfoPane } from './InfoPane';
import { MigrationStepsPane } from './MigrationStepsPane';

export const EmptyState = () => {
  return (
    <Stack gap={4} direction="column">
      <InfoPane />
      <MigrationStepsPane />
    </Stack>
  );
};
