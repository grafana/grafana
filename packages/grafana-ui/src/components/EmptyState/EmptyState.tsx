import React, { ReactNode } from 'react';

import { t } from '../../utils/i18n';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';

import { GrotNotFound } from './GrotNotFound/GrotNotFound';

interface BaseProps {
  /**
   * Provide a CTA button to render below the message, e.g. **EmptyStateCTAButton**
   */
  button?: ReactNode;
  /**
   * Override the default image for the variant
   */
  image?: ReactNode;
  message?: string;
  hideImage?: boolean;
  variant?: 'search' | 'default';
}

interface DefaultVariantProps extends BaseProps {
  message: string;
  variant?: 'default';
}

interface SearchVariantProps extends BaseProps {
  variant: 'search';
}

type Props = DefaultVariantProps | SearchVariantProps;

export const EmptyState = ({
  button,
  children,
  hideImage = false,
  image = <GrotNotFound width={300} />,
  message = t('grafana-ui.empty-state.search-message', 'No results found'),
  variant = 'default',
}: React.PropsWithChildren<Props>) => {
  return (
    <Box alignItems="center" direction="column" display="flex" gap={4} paddingY={4}>
      {!hideImage && image}
      <Stack direction="column" alignItems="center">
        <Text variant="h4">{message}</Text>
        {children && <Text color="secondary">{children}</Text>}
      </Stack>
      {button}
    </Box>
  );
};
