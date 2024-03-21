import React, { ReactNode } from 'react';

import { t } from '../../../utils/i18n';
import { Box } from '../../Layout/Box/Box';
import { Stack } from '../../Layout/Stack/Stack';
import { Text } from '../../Text/Text';

import { GrotNotFound } from './GrotNotFound/GrotNotFound';

interface Props {
  image?: ReactNode;
  message?: string;
  showImage?: boolean;
}

export const EmptySearchState = ({
  children,
  image = <GrotNotFound width={300} />,
  message = t('grafana-ui.empty-search-state.message', 'No results found'),
  showImage = true,
}: React.PropsWithChildren<Props>) => {
  return (
    <Box paddingY={4} gap={4} display="flex" direction="column" alignItems="center">
      {showImage && image}
      <Stack direction="column" alignItems="center">
        <Text variant="h4">{message}</Text>
        {children && <Text color="secondary">{children}</Text>}
      </Stack>
    </Box>
  );
};
