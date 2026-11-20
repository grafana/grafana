import { useState } from 'react';

import { t } from '@grafana/i18n';

import { Button } from '../Button/Button';
import { IconButton } from '../IconButton/IconButton';
import { Input } from '../Input/Input';
import { Stack } from '../Layout/Stack/Stack';

type BaseProps = React.ComponentProps<typeof Input> & {
  /** TRUE if the secret was already configured. (It is needed as often the backend doesn't send back the actual secret, only the information that it was configured) */
  isConfigured: boolean;
  /** Called when the user clicks on the "Reset" button in order to clear the secret */
  onReset: () => void;
};

type RevealableProps = {
  /**
   * Shows an eye icon button that toggles the secret between masked and plain text.
   * The toggle occupies the input's suffix slot, so `suffix` cannot be used together with it.
   */
  revealable: true;
  suffix?: never;
};

type NonRevealableProps = {
  revealable?: false;
};

export type Props = BaseProps & (RevealableProps | NonRevealableProps);

export const CONFIGURED_TEXT = 'configured';
export const RESET_BUTTON_TEXT = 'Reset';

/**
 * Used for secret/password input.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-secretinput--docs
 */
export const SecretInput = ({ isConfigured, onReset, revealable, ...props }: Props) => {
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible
    ? t('grafana-ui.secret-input.hide', 'Hide secret')
    : t('grafana-ui.secret-input.show', 'Show secret');

  return (
    <Stack>
      {!isConfigured && (
        <Input
          {...props}
          type={revealable && visible ? 'text' : 'password'}
          suffix={
            // While loading, leave the suffix slot empty so Input's built-in spinner takes over.
            revealable && !props.loading ? (
              <IconButton
                name={visible ? 'eye-slash' : 'eye'}
                aria-controls={props.id}
                role="switch"
                aria-checked={visible}
                onClick={() => setVisible(!visible)}
                tooltip={toggleLabel}
                size="sm"
              />
            ) : (
              props.suffix
            )
          }
        />
      )}
      {isConfigured && (
        <>
          <Input {...props} type="text" disabled={true} value={CONFIGURED_TEXT} />
          <Button onClick={onReset} variant="secondary">
            {RESET_BUTTON_TEXT}
          </Button>
        </>
      )}
    </Stack>
  );
};
