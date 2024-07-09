import { Box, Grid, Stack } from '@grafana/ui';

import { CallToAction } from './CallToAction/CallToAction';
import { InfoPaneLeft } from './InfoPaneLeft';
import { InfoPaneRight } from './InfoPaneRight';

export const EmptyState = () => {
  return (
    <Box backgroundColor="secondary" display="flex" alignItems="center" direction="column">
      <Box maxWidth={180} paddingY={6} paddingX={2}>
        <Stack gap={5} direction="column">
          <CallToAction />

          <Grid
            alignItems="flex-start"
            gap={4}
            columns={{
              xs: 1,
              lg: 2,
            }}
          >
            <InfoPaneLeft />
            <InfoPaneRight />
          </Grid>
        </Stack>
      </Box>
    </Box>
  );
};
