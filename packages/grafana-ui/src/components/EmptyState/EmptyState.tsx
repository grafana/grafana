import React from 'react';

import { Button, LinkButton } from '../Button';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';

import { GrotNotFound } from './EmptySearchState/GrotNotFound/GrotNotFound';

interface BaseProps {
  buttonLabel?: string;
  buttonHref?: string;
  message: string;
  onButtonClick?: () => void;
  showImage?: boolean;
}

interface PropsWithCTALink extends BaseProps {
  buttonLabel: string;
  buttonHref: string;
}

interface PropsWithCTAButton extends BaseProps {
  buttonLabel: string;
  onButtonClick: () => void;
}

type Props = BaseProps | PropsWithCTALink | PropsWithCTAButton;

export const EmptyState = ({
  buttonHref,
  buttonLabel,
  children,
  message,
  onButtonClick,
  showImage = true,
}: React.PropsWithChildren<Props>) => {
  const ButtonElement = buttonHref ? LinkButton : Button;

  return (
    <Box paddingY={4}>
      <Stack gap={2} direction="column" alignItems="center">
        <Text variant="h5">{message}</Text>
        {buttonLabel && (
          <ButtonElement href={buttonHref} icon="plus" size="lg" onClick={onButtonClick}>
            {buttonLabel}
          </ButtonElement>
        )}
        {showImage && <GrotNotFound width={300} />}
        {children && <Text color="secondary">{children}</Text>}
      </Stack>
    </Box>
  );
};
