/* eslint-disable @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any */
import React from 'react';

import { useStyles } from '@grafana/ui';
import { RetryMode } from 'app/percona/backup/Backup.types';
import { NumberInputField } from 'app/percona/shared/components/Form/NumberInput';
import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';

import { RETRY_MODE_OPTIONS } from '../AddBackupPage.constants';
import { Messages } from '../AddBackupPage.messages';

import { getStyles } from './RetryModeSelector.styles';
import { RetryModeSelectorProps } from './RetryModeSelector.types';
import { retryIntervalValidator, retryTimesValidator } from './RetryModeSelector.utils';

export const RetryModeSelector = ({ retryMode, disabled = false }: RetryModeSelectorProps) => {
  const disabledNumberInputs = retryMode === RetryMode.MANUAL || disabled;
  const styles = useStyles(getStyles);

  return (
    <div data-testid="retry-mode-selector" className={styles.retryFieldWrapper}>
      <span className={styles.radioButtonField}>
        <RadioButtonGroupField
          options={RETRY_MODE_OPTIONS}
          name="retryMode"
          label={Messages.retryMode}
          disabled={disabled}
          fullWidth
        />
      </span>
      <span className={styles.numberInputFieldWrapper}>
        <NumberInputField
          // TODO fix typings in core. Validator must accept allValues as second arg
          validators={[retryTimesValidator as any]}
          disabled={disabledNumberInputs}
          fieldClassName={styles.retryField}
          name="retryTimes"
          label={Messages.retryTimes}
        />
        <NumberInputField
          validators={[retryIntervalValidator as any]}
          disabled={disabledNumberInputs}
          fieldClassName={styles.retryField}
          name="retryInterval"
          label={Messages.retryInterval}
        />
      </span>
    </div>
  );
};
