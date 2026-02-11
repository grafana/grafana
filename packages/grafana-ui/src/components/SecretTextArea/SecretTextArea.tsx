import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Button } from '../Button/Button';
import { IconButton } from '../IconButton/IconButton';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { TextArea } from '../TextArea/TextArea';

export type Props = React.ComponentProps<typeof TextArea> & {
  /** TRUE if the secret was already configured. (It is needed as often the backend doesn't send back the actual secret, only the information that it was configured) */
  isConfigured: boolean;
  /** Called when the user clicks on the "Reset" button in order to clear the secret */
  onReset: () => void;
  /** If true, the text area will grow to fill available width. */
  grow?: boolean;
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
    maskedTextArea: css({
      WebkitTextSecurity: 'disc',
    }),
    textAreaWrapper: css({
      position: 'relative',
    }),
    toggleButton: css({
      position: 'absolute',
      top: theme.spacing(1),
      right: theme.spacing(3),
      zIndex: 1,
    }),
  };
};

/**
 * Text area that does not disclose an already configured value but lets the user reset the current value and enter a new one.
 * Typically useful for asymmetric cryptography keys.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-secrettextarea--docs
 */
export const SecretTextArea = ({ isConfigured, onReset, grow, ...props }: Props) => {
  const [contentVisible, setContentVisible] = useState(false);
  const styles = useStyles2(getStyles);
  const toggleLabel = contentVisible
    ? t('grafana-ui.secret-text-area.hide-content', 'Hide secret content')
    : t('grafana-ui.secret-text-area.show-content', 'Show secret content');

  return (
    <Stack>
      <Box grow={grow ? 1 : undefined}>
        {!isConfigured && (
          <div className={styles.textAreaWrapper}>
            <IconButton
              className={styles.toggleButton}
              name={contentVisible ? 'eye-slash' : 'eye'}
              onClick={() => setContentVisible(!contentVisible)}
              aria-label={toggleLabel}
              tooltip={toggleLabel}
              size="sm"
            />
            <TextArea {...props} className={cx(!contentVisible && styles.maskedTextArea, props.className)} />
          </div>
        )}
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
