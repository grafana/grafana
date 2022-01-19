import React from 'react';
import { useStyles } from '@grafana/ui';
import { NumberInputField, RadioButtonGroupField } from '@percona/platform-core';
import { RetryMode } from 'app/percona/backup/Backup.types';
import { Messages } from '../AddBackupModal.messages';
import { RETRY_MODE_OPTIONS } from '../AddBackupModal.constants';
import { RetryModeSelectorProps } from './RetryModeSelector.types';
import { getStyles } from './RetryModeSelector.styles';
import { retryTimesValidator, retryIntervalValidator } from './RetryModeSelector.utils';

export const RetryModeSelector = ({ retryMode, disabled = false }: RetryModeSelectorProps) => {
  const disabledNumberInputs = retryMode === RetryMode.MANUAL || disabled;
  const styles = useStyles(getStyles);

  return (
    <div data-testid="retry-mode-selector">
      <RadioButtonGroupField
        options={RETRY_MODE_OPTIONS}
        name="retryMode"
        label={Messages.retryMode}
        disabled={disabled}
        fullWidth
      />
      <div className={styles.retryFields}>
        <NumberInputField
          // TODO fix typings in core. Validator must accept allValues as second arg
          validators={[retryTimesValidator as any]}
          disabled={disabledNumberInputs}
          fieldClassName={styles.retrySelect}
          name="retryTimes"
          label={Messages.retryTimes}
        />
        <NumberInputField
          validators={[retryIntervalValidator as any]}
          disabled={disabledNumberInputs}
          fieldClassName={styles.retrySelect}
          name="retryInterval"
          label={Messages.retryInterval}
        />
      </div>
    </div>
  );
};
