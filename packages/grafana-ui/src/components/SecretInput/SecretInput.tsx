import * as React from 'react';
import { useState } from 'react';

import { t } from '@grafana/i18n';

import { Button } from '../Button/Button';
import { IconButton } from '../IconButton/IconButton';
import { Input } from '../Input/Input';
import { Stack } from '../Layout/Stack/Stack';

export type Props = React.ComponentProps<typeof Input> & {
  /** TRUE if the secret was already configured. (It is needed as often the backend doesn't send back the actual secret, only the information that it was configured) */
  isConfigured: boolean;
  /** Called when the user clicks on the "Reset" button in order to clear the secret */
  onReset: () => void;
};

export const CONFIGURED_TEXT = 'configured';
export const RESET_BUTTON_TEXT = 'Reset';

/**
 * Used for secret/password input.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-secretinput--docs
 */
export const SecretInput = ({ isConfigured, onReset, ...props }: Props) => {
  // Some browser extensions block paste from clipboard to password fields. This is a workaround to allow bypass this limitation.
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible
    ? t('grafana-ui.secret-input.hide', 'Hide secret')
    : t('grafana-ui.secret-input.show', 'Show secret');

  return (
    <Stack>
      {!isConfigured && (
        <Input
          {...props}
          type={visible ? 'text' : 'password'}
          suffix={
            <IconButton
              name={visible ? 'eye-slash' : 'eye'}
              aria-controls={props.id}
              role="switch"
              aria-checked={visible}
              onClick={() => setVisible(!visible)}
              tooltip={toggleLabel}
            />
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
