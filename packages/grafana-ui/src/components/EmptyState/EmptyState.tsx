import React, { ReactNode } from 'react';
import SVG from 'react-inlinesvg';

import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';

import { GrotCTA } from './GrotCTA/GrotCTA';
import { GrotNotFound } from './GrotNotFound/GrotNotFound';
import GrotCompleted from './grot-completed.svg';

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
  variant: 'call-to-action' | 'not-found' | 'completed';
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
        <Text variant="h4" textAlignment="center">
          {message}
        </Text>
        {children && (
          <Text color="secondary" textAlignment="center">
            {children}
          </Text>
        )}
      </Stack>
      {button}
    </Box>
  );
};

function getDefaultImageForVariant(variant: Props['variant']) {
  switch (variant) {
    case 'call-to-action': {
      return <GrotCTA width={300} />;
    }
    case 'not-found': {
      return <GrotNotFound width={300} />;
    }
    case 'completed': {
      return <SVG src={GrotCompleted} width={300} />;
    }
    default: {
      throw new Error(`Unknown variant: ${variant}`);
    }
  }
}
