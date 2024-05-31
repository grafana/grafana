import { css } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes';
import { Button, ButtonVariant } from '../Button';
import { Input } from '../Input/Input';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { JustifyContent } from '../Layout/types';
import { ResponsiveProp } from '../Layout/utils/responsiveness';

export interface ConfirmContentProps {
  /** Modal content */
  body: React.ReactNode;
  /** Modal description */
  description?: React.ReactNode;
  /** Text for confirm button */
  confirmText: string;
  /** Text for dismiss button */
  dismissText?: string;
  /** Variant for dismiss button */
  dismissVariant?: ButtonVariant;
  /** Text user needs to fill in before confirming */
  fillToConfirmText?: string;
  /** Text for alternative button */
  alternativeText?: string;
  /** Confirm button variant */
  confirmButtonVariant?: ButtonVariant;
  /** Justify for buttons placement */
  justifyButtons?: ResponsiveProp<JustifyContent>;
  /** Confirm action callback
   * Return a promise to disable the confirm button until the promise is resolved
   */
  onConfirm(): void | Promise<void>;
  /** Dismiss action callback */
  onDismiss(): void;
  /** Alternative action callback */
  onAlternative?(): void;
}

export const ConfirmContent = ({
  body,
  fillToConfirmText,
  confirmText,
  confirmButtonVariant,
  dismissVariant,
  dismissText,
  onConfirm,
  onDismiss,
  onAlternative,
  alternativeText,
  description,
  justifyButtons = 'flex-end',
}: ConfirmContentProps) => {
  const [disabled, setDisabled] = useState(Boolean(fillToConfirmText));
  const styles = useStyles2(getStyles);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const onConfirmationTextChange = (event: React.FormEvent<HTMLInputElement>) => {
    setDisabled(fillToConfirmText?.toLowerCase().localeCompare(event.currentTarget.value.toLowerCase()) !== 0);
  };

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    setDisabled(Boolean(fillToConfirmText));
  }, [fillToConfirmText]);

  const onConfirmClick = async () => {
    setDisabled(true);
    try {
      await onConfirm();
    } finally {
      setDisabled(false);
    }
  };

  const { handleSubmit } = useForm();

  return (
    <form onSubmit={handleSubmit(onConfirmClick)}>
      <div className={styles.text}>
        {body}
        {description ? <div className={styles.description}>{description}</div> : null}
        {fillToConfirmText ? (
          <div className={styles.confirmationInput}>
            <Stack alignItems="flex-start">
              <Box>
                <Input placeholder={`Type "${fillToConfirmText}" to confirm`} onChange={onConfirmationTextChange} />
              </Box>
            </Stack>
          </div>
        ) : null}
      </div>
      <div className={styles.buttonsContainer}>
        <Stack justifyContent={justifyButtons} gap={2} wrap="wrap">
          <Button variant={dismissVariant} onClick={onDismiss} fill="outline">
            {dismissText}
          </Button>
          <Button
            type="submit"
            variant={confirmButtonVariant}
            disabled={disabled}
            ref={buttonRef}
            data-testid={selectors.pages.ConfirmModal.delete}
          >
            {confirmText}
          </Button>
          {onAlternative ? (
            <Button variant="primary" onClick={onAlternative}>
              {alternativeText}
            </Button>
          ) : null}
        </Stack>
      </div>
    </form>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  text: css({
    fontSize: theme.typography.h5.fontSize,
    color: theme.colors.text.primary,
  }),
  description: css({
    fontSize: theme.typography.body.fontSize,
  }),
  confirmationInput: css({
    paddingTop: theme.spacing(1),
  }),
  buttonsContainer: css({
    paddingTop: theme.spacing(3),
  }),
});
