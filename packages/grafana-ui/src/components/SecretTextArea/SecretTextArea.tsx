import { css, cx } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { Button } from '../Button/Button';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { TextArea } from '../TextArea/TextArea';

export type Props = React.ComponentProps<typeof TextArea> & {
  /** TRUE if the secret was already configured. (It is needed as often the backend doesn't send back the actual secret, only the information that it was configured) */
  isConfigured: boolean;
  /** Called when the user clicks on the "Reset" button in order to clear the secret */
  onReset: () => void;
};

export const CONFIGURED_TEXT = 'configured';
export const RESET_BUTTON_TEXT = 'Reset';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    configuredStyle: css({
      minHeight: theme.spacing(theme.components.height.md),
      paddingTop: theme.spacing(0.5) /** Needed to mimic vertically centered text in an input box */,
      resize: 'none',
    }),
  };
};

/**
 * Text area that does not disclose an already configured value but lets the user reset the current value and enter a new one.
 * Typically useful for asymmetric cryptography keys.
 */
export const SecretTextArea = ({ isConfigured, onReset, ...props }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <Stack>
      <Box>
        {!isConfigured && <TextArea {...props} />}
        {isConfigured && (
          <TextArea
            {...props}
            rows={1}
            disabled={true}
            value={CONFIGURED_TEXT}
            className={cx(styles.configuredStyle)}
          />
        )}
      </Box>
      {isConfigured && (
        <Button onClick={onReset} variant="secondary">
          {RESET_BUTTON_TEXT}
        </Button>
      )}
    </Stack>
  );
};
