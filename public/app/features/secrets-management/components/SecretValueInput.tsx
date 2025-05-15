import React from 'react';

import { Button, Input, Stack, TextArea } from '@grafana/ui';

export type SecretValueInputProps = React.ComponentProps<typeof TextArea> & {
  isConfigured: boolean;
  onReset: () => void;
};

const CONFIGURED_TEXT = 'configured';
const RESET_BUTTON_TEXT = 'Reset';

export const SecretValueInput = React.forwardRef<HTMLTextAreaElement, SecretValueInputProps>(
  ({ isConfigured, onReset, ...props }, ref) => {
    return (
      <Stack>
        {!isConfigured && (
          <>
            <TextArea ref={ref} rows={5} id="secret-value" disabled={isConfigured} {...props} />
          </>
        )}
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
