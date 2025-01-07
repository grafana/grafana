import { ReactNode } from 'react';

import { useStyles2 } from '../../themes';
import { Trans } from '../../utils/i18n';
import { Icon } from '../Icon/Icon';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';

import { getComboboxStyles } from './getComboboxStyles';

export const AsyncError = () => {
  const styles = useStyles2(getComboboxStyles);
  return (
    <MessageRow>
      <Icon name="exclamation-triangle" size="md" className={styles.warningIcon} />
      <Trans i18nKey="combobox.async.error">An error occurred while loading options.</Trans>
    </MessageRow>
  );
};

export const NotFoundError = () => (
  <MessageRow>
    <Trans i18nKey="combobox.options.no-found">No options found.</Trans>
  </MessageRow>
);

const MessageRow = ({ children }: { children: ReactNode }) => {
  return (
    <Box padding={2} color="secondary">
      <Stack justifyContent="center" alignItems="center">
        {children}
      </Stack>
    </Box>
  );
};
