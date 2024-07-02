import { Box } from '@grafana/ui';

import { EmptyState } from './EmptyState/EmptyState';

export const Page = () => {
  return (
    <Box backgroundColor="secondary" display="flex" alignItems="center" direction="column">
      <Box maxWidth={90} paddingY={6} paddingX={2}>
        <EmptyState />
      </Box>
    </Box>
  );
};
