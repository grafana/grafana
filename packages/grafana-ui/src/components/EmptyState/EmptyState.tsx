import React, { ReactNode } from 'react';

import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';

import { GrotNotFound } from './GrotNotFound/GrotNotFound';

interface Props {
  /**
   * Provide a button to render below the message
   */
  button?: ReactNode;
  hideImage?: boolean;
  /**
   * Override the default image for the variant
   */
  image?: ReactNode;
  /**
   * Message to display to the user
   */
  message: string;
  /**
   * Empty state variant. Possible values are 'search'.
   */
  variant: 'not-found';
}

export const EmptyState = ({
  button,
  children,
  image = <GrotNotFound width={300} />,
  message,
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
