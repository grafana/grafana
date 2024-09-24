import { Box, Stack } from '@grafana/ui';

import { InfoPane } from './EmptyState/InfoPane';
import { MigrationStepsPane } from './EmptyState/MigrationStepsPane';
import { MigrationTokenPane } from './MigrationTokenPane/MigrationTokenPane';

export const Page = () => {
  return (
    <Box backgroundColor="secondary" display="flex" alignItems="center" direction="column">
      <Box maxWidth={90} paddingY={6} paddingX={2} gap={6} direction="column" display="flex">
        <Stack gap={2} direction="column">
          <InfoPane />
          <MigrationTokenPane />
        </Stack>

        <MigrationStepsPane />
      </Box>
    </Box>
  );
};
