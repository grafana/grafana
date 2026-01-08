import * as React from 'react';

import { t } from '@grafana/i18n';
import { Button, Input, Stack, TextArea } from '@grafana/ui';

export type SecretTextAreaProps = React.ComponentProps<typeof TextArea> & {
  /** TRUE if the secret was already configured. (It is needed as often the backend doesn't send back the actual secret, only the information that it was configured) */
  isConfigured: boolean;
  /** Called when the user clicks on the "Reset" button in order to clear the secret */
  onReset: () => void;
};

const CONFIGURED_TEXT = t('provisioning.secret-textarea.configured', 'configured');
const RESET_BUTTON_TEXT = t('provisioning.secret-textarea.reset', 'Reset');

/**
 * Used for secret/password input that needs multi-line support (e.g., PEM files).
 * Based on SecretInput pattern from @grafana/ui and SecretValueInput from extensions.
 */
export const SecretTextArea = React.forwardRef<HTMLTextAreaElement, SecretTextAreaProps>(
  ({ isConfigured, onReset, rows = 8, ...props }, ref) => {
    return (
      <Stack>
        {!isConfigured && <TextArea ref={ref} rows={rows} {...props} />}
        {isConfigured && (
          <>
            <Input type="text" disabled value={CONFIGURED_TEXT} id={props.id} />
            <Button onClick={onReset} variant="secondary">
              {RESET_BUTTON_TEXT}
            </Button>
          </>
        )}
      </Stack>
    );
  }
);

SecretTextArea.displayName = 'SecretTextArea';
