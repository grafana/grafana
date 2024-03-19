import React from 'react';

import { t } from '../../../utils/i18n';
import { Box } from '../../Layout/Box/Box';
import { Stack } from '../../Layout/Stack/Stack';
import { Text } from '../../Text/Text';

import { GrotNotFound } from './GrotNotFound/GrotNotFound';

interface Props {
  showImage?: boolean;
  message?: string;
}

export const EmptySearchState = ({
  children,
  message = t('grafana-ui.empty-search-state.message', 'No results found'),
  showImage = true,
}: React.PropsWithChildren<Props>) => {
  return (
    <Box padding={2}>
      <Stack gap={2} direction="column" alignItems="center">
        {showImage && <GrotNotFound width={300} />}
        <Text variant="h3">{message}</Text>
        {children && <Text color="secondary">{children}</Text>}
      </Stack>
    </Box>
  );
};
