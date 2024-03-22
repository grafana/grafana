import React, { ReactNode } from 'react';

import { t } from '../../utils/i18n';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';

import { GrotNotFound } from './GrotNotFound/GrotNotFound';

interface Props {
  /**
   * Provide a CTA button to render below the message
   */
  button?: ReactNode;
  hideImage?: boolean;
  /**
   * Override the default image for the variant
   */
  image?: ReactNode;
  message?: string;
  variant: 'search';
}

export const EmptyState = ({
  button,
  children,
  image = <GrotNotFound width={300} />,
  message = t('grafana-ui.empty-state.search-message', 'No results found'),
  hideImage = false,
}: React.PropsWithChildren<Props>) => {
  return (
    <Box paddingY={4} gap={4} display="flex" direction="column" alignItems="center">
      {!hideImage && image}
      <Stack direction="column" alignItems="center">
        <Text variant="h4">{message}</Text>
        {children && <Text color="secondary">{children}</Text>}
      </Stack>
      {button}
    </Box>
  );
};
