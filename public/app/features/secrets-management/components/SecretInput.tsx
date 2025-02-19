import { css } from '@emotion/css';
import { forwardRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Input, IconButton, Button, useStyles2 } from '@grafana/ui';
import { Props as InputProps } from '@grafana/ui/src/components/Input/Input';

interface SecretInputProps extends Omit<InputProps, 'type'> {
  isConfigured?: boolean;
  revealTooltip?: string;
  hiddenTooltip?: string;
}

export const SecretInput = forwardRef<HTMLInputElement, SecretInputProps>((props, ref) => {
  const [reveal, setReveal] = useState(false);
  const { revealTooltip = 'Hide secret', hiddenTooltip = 'Show secret', isConfigured = false, ...inputProps } = props;
  const styles = useStyles2(getStyles);
  const [canEdit, setCanEdit] = useState(!isConfigured);

  return (
    <>
      <div className={styles.wrapper}>
        <Input
          {...inputProps}
          type={reveal && canEdit ? 'text' : 'password'}
          ref={ref}
          disabled={!canEdit}
          placeholder={!canEdit ? 'Secret is configured' : 'Enter secret value'}
          suffix={
            canEdit && (
              <IconButton
                name={reveal ? 'eye-slash' : 'eye'}
                aria-controls={props.id}
                role="switch"
                aria-checked={reveal}
                onClick={() => {
                  setReveal(!reveal);
                }}
                tooltip={reveal ? revealTooltip : hiddenTooltip}
              />
            )
          }
        />
        {!canEdit && (
          <Button
            variant="destructive"
            tooltip="By clicking this button, you will be able to change the secret value. Value is not modified until the form is submitted."
            onClick={() => setCanEdit(true)}
          >
            Reset
          </Button>
        )}
      </div>
    </>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
});

SecretInput.displayName = 'SecretInput';
