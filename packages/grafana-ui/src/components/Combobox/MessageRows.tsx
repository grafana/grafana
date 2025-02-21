import { ReactNode } from 'react';

import { Trans } from '../../utils/i18n';
import { Icon } from '../Icon/Icon';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';

export const AsyncError = () => (
  <MessageRow>
    <Text color="warning">
      <Icon name="exclamation-triangle" size="md" />
    </Text>
    <Trans i18nKey="combobox.async.error">An error occurred while loading options.</Trans>
  </MessageRow>
);

export const NotFoundError = () => (
  <MessageRow>
    <Trans i18nKey="combobox.options.no-found">No options found.</Trans>
  </MessageRow>
);

const MessageRow = ({ children }: { children: ReactNode }) => {
  return (
    <Box padding={2}>
      <Stack justifyContent="center" alignItems="center" direction="column">
        {children}
      </Stack>
    </Box>
  );
};
