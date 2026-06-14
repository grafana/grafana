import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { Box, Stack } from '@grafana/ui';

// Mirrors the base homepage layout (tab bar + 256px dashboard list) so the
// reveal after extensions load doesn't shift the page.
export function HomePageSkeleton() {
  return (
    <div data-testid="home-page-skeleton">
      <Box backgroundColor="canvas" borderRadius="default" padding={4} direction="column" display="flex" gap={2}>
        <Stack direction="row" gap={2}>
          <Skeleton width={140} height={24} />
          <Skeleton width={140} height={24} />
        </Stack>
        <Skeleton height={256} containerClassName={styles.content} />
      </Box>
    </div>
  );
}

const styles = {
  content: css({
    display: 'block',
  }),
};
