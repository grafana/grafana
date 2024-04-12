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
   * Which variant to use. Affects the default image shown.
   */
  variant: 'call-to-action' | 'not-found';
}

export const EmptyState = ({
  button,
  children,
  image,
  message,
  hideImage = false,
  variant,
}: React.PropsWithChildren<Props>) => {
  const imageToShow = image ?? getDefaultImageForVariant(variant);

  return (
    <Box paddingY={4} gap={4} display="flex" direction="column" alignItems="center">
      {!hideImage && imageToShow}
      <Stack direction="column" alignItems="center">
        <Text variant="h4">{message}</Text>
        {children && <Text color="secondary">{children}</Text>}
      </Stack>
      {button}
    </Box>
  );
};

function getDefaultImageForVariant(variant: Props['variant']) {
  switch (variant) {
    case 'call-to-action': {
      // TODO replace with a different image for initial variant
      return <GrotNotFound width={300} />;
    }
    case 'not-found': {
      return <GrotNotFound width={300} />;
    }
    default: {
      throw new Error(`Unknown variant: ${variant}`);
    }
  }
}
