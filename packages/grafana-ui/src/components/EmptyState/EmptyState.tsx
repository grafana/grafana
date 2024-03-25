import React, { ReactNode } from 'react';

import { t } from '../../utils/i18n';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';

import { GrotNotFound } from './GrotNotFound/GrotNotFound';

interface BaseProps {
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
  message?: string;
  /**
   * Which variant to use. Affects the default message and image shown.
   */
  variant: 'initial' | 'not-found';
}

interface InitialVariantProps extends BaseProps {
  message: string;
  variant: 'initial';
}

interface SearchVariantProps extends BaseProps {
  variant: 'not-found';
}

type Props = InitialVariantProps | SearchVariantProps;

export const EmptyState = ({
  button,
  children,
  image,
  message,
  hideImage = false,
  variant,
}: React.PropsWithChildren<Props>) => {
  const imageToShow = image ?? getDefaultImageForVariant(variant);
  const messageToShow = message ?? getDefaultMessageForVariant(variant);

  return (
    <Box paddingY={4} gap={4} display="flex" direction="column" alignItems="center">
      {!hideImage && imageToShow}
      <Stack direction="column" alignItems="center">
        <Text variant="h4">{messageToShow}</Text>
        {children && <Text color="secondary">{children}</Text>}
      </Stack>
      {button}
    </Box>
  );
};

function getDefaultMessageForVariant(variant: Props['variant']) {
  switch (variant) {
    case 'initial': {
      return t('grafana-ui.empty-state.initial-message', "There's nothing here yet");
    }
    case 'not-found': {
      return t('grafana-ui.empty-state.not-found-message', 'No results found');
    }
    default: {
      throw new Error(`Unknown variant: ${variant}`);
    }
  }
}

function getDefaultImageForVariant(variant: Props['variant']) {
  switch (variant) {
    case 'initial': {
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
