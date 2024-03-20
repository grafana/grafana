import React, { ReactNode } from 'react';

import { Button, LinkButton } from '../Button';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';

import { GrotNotFound } from './EmptySearchState/GrotNotFound/GrotNotFound';

interface BaseProps {
  buttonLabel?: string;
  buttonHref?: string;
  image?: ReactNode;
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
  image = <GrotNotFound width={300} />,
  message,
  onButtonClick,
  showImage = true,
}: React.PropsWithChildren<Props>) => {
  const ButtonElement = buttonHref ? LinkButton : Button;

  return (
    <Box alignItems="center" direction="column" display="flex" gap={4} paddingY={4}>
      {showImage && image}
      <Stack direction="column" alignItems="center">
        <Text variant="h4">{message}</Text>
        {children && <Text color="secondary">{children}</Text>}
      </Stack>
      {buttonLabel && (
        <ButtonElement href={buttonHref} size="lg" onClick={onButtonClick}>
          {buttonLabel}
        </ButtonElement>
      )}
    </Box>
  );
};
