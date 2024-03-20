import React from 'react';

import { t } from '../../../utils/i18n';
import { Box } from '../../Layout/Box/Box';
import { Stack } from '../../Layout/Stack/Stack';
import { Text } from '../../Text/Text';

import { GrotNotFound } from './GrotNotFound/GrotNotFound';

interface Props {
  message?: string;
  showImage?: boolean;
}

export const EmptySearchState = ({
  children,
  message = t('grafana-ui.empty-search-state.message', 'No results found'),
  showImage = true,
}: React.PropsWithChildren<Props>) => {
  return (
    <Box paddingY={4}>
      <Stack gap={4} direction="column" alignItems="center">
        {showImage && <GrotNotFound width={300} />}
        <Stack direction="column" alignItems="center">
          <Text variant="h4">{message}</Text>
          {children && <Text color="secondary">{children}</Text>}
        </Stack>
      </Stack>
    </Box>
  );
};
