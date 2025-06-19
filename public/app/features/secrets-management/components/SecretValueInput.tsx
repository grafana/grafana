import React from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, Input, Stack, TextArea } from '@grafana/ui';

export type SecretValueInputProps = React.ComponentProps<typeof TextArea> & {
  isConfigured: boolean;
  onReset: () => void;
};

export const SecretValueInput = React.forwardRef<HTMLTextAreaElement, SecretValueInputProps>(
  ({ isConfigured, onReset, rows = 5, ...props }, ref) => {
    return (
      <Stack>
        {!isConfigured && (
          <>
            <TextArea ref={ref} rows={rows} id={props.id} disabled={isConfigured} {...props} />
          </>
        )}
        {isConfigured && (
          <>
            <Input
              type="text"
              disabled
              value={t('secrets.secret-value-input.configured-value', 'configured')}
              id={props.id}
            />
            <Trans i18nKey="secrets.secret-value-input.reset-button">
              <Button onClick={onReset} variant="secondary">
                Reset
              </Button>
            </Trans>
          </>
        )}
      </Stack>
    );
  }
);
