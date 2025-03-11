import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes';
import { t } from '../../utils/i18n';
import { Button, ButtonVariant } from '../Button';
import { Field } from '../Forms/Field';
import { Input } from '../Input/Input';
import { Stack } from '../Layout/Stack/Stack';
import { JustifyContent } from '../Layout/types';
import { ResponsiveProp } from '../Layout/utils/responsiveness';

export interface ConfirmContentProps {
  /** Modal content */
  body: React.ReactNode;
  /** Modal description */
  description?: React.ReactNode;
  /** Text for confirm button */
  confirmButtonLabel: string;
  /** Confirm button variant */
  confirmButtonVariant?: ButtonVariant;
  /** Text user needs to fill in before confirming */
  confirmPromptText?: string;
  /** Text for dismiss button */
  dismissButtonLabel?: string;
  /** Variant for dismiss button */
  dismissButtonVariant?: ButtonVariant;
  /** Text for alternative button */
  alternativeButtonLabel?: string;
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
  /** Disable the confirm button and the confirm text input if needed */
  disabled?: boolean;
}

export const ConfirmContent = ({
  body,
  confirmPromptText,
  confirmButtonLabel,
  confirmButtonVariant,
  dismissButtonVariant,
  dismissButtonLabel,
  onConfirm,
  onDismiss,
  onAlternative,
  alternativeButtonLabel,
  description,
  justifyButtons = 'flex-end',
  disabled,
}: ConfirmContentProps) => {
  const [isDisabled, setIsDisabled] = useState(disabled);
  const styles = useStyles2(getStyles);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const onConfirmationTextChange = (event: React.FormEvent<HTMLInputElement>) => {
    setIsDisabled(confirmPromptText?.toLowerCase().localeCompare(event.currentTarget.value.toLowerCase()) !== 0);
  };

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    setIsDisabled(disabled ? true : Boolean(confirmPromptText));
  }, [confirmPromptText, disabled]);

  const onConfirmClick = async () => {
    if (disabled === undefined) {
      setIsDisabled(true);
    }
    try {
      await onConfirm();
    } finally {
      if (disabled === undefined) {
        setIsDisabled(false);
      }
    }
  };

  const { handleSubmit } = useForm();
  const placeholder = t('grafana-ui.confirm-content.placeholder', 'Type "{{confirmPromptText}}" to confirm', {
    confirmPromptText,
  });
  return (
    <form onSubmit={handleSubmit(onConfirmClick)}>
      <div className={styles.text}>
        {body}
        {description ? <div className={styles.description}>{description}</div> : null}
        {confirmPromptText ? (
          <div className={styles.confirmationInput}>
            <Stack alignItems="flex-start">
              <Field disabled={disabled}>
                <Input placeholder={placeholder} onChange={onConfirmationTextChange} />
              </Field>
            </Stack>
          </div>
        ) : null}
      </div>
      <div className={styles.buttonsContainer}>
        <Stack justifyContent={justifyButtons} gap={2} wrap="wrap">
          <Button variant={dismissButtonVariant} onClick={onDismiss} fill="outline">
            {dismissButtonLabel}
          </Button>
          <Button
            type="submit"
            variant={confirmButtonVariant}
            disabled={isDisabled}
            ref={buttonRef}
            data-testid={selectors.pages.ConfirmModal.delete}
          >
            {confirmButtonLabel}
          </Button>
          {onAlternative ? (
            <Button variant="primary" onClick={onAlternative}>
              {alternativeButtonLabel}
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
