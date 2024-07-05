import { Box } from '@grafana/ui';

import { InfoPane } from './EmptyState/InfoPane';
import { MigrationStepsPane } from './EmptyState/MigrationStepsPane';

export const Page = () => {
  return (
    <Box backgroundColor="secondary" display="flex" alignItems="center" direction="column">
      <Box maxWidth={90} paddingY={6} paddingX={2} gap={6} direction="column" display="flex">
        <InfoPane />
        <MigrationStepsPane />
      </Box>
    </Box>
  );
};
