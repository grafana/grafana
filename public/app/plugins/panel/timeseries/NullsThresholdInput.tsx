import * as React from 'react';

import { rangeUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Input } from '@grafana/ui';

export enum InputPrefix {
  LessThan = 'lessthan',
  GreaterThan = 'greaterthan',
}

type Props = {
  value: number;
  onChange: (value?: number | boolean | undefined) => void;
  inputPrefix?: InputPrefix;
  isTime: boolean;
};

export const NullsThresholdInput = ({ value, onChange, inputPrefix, isTime }: Props) => {
  let defaultValue = rangeUtil.secondsToHms(value / 1000);
  if (!isTime) {
    defaultValue = '10';
  }
  const checkAndUpdate = (txt: string) => {
    let val: boolean | number = false;
    if (txt) {
      try {
        if (isTime && rangeUtil.isValidTimeSpan(txt)) {
          val = rangeUtil.intervalToMs(txt);
        } else {
          val = Number(txt);
        }
      } catch (err) {
        console.warn('ERROR', err);
      }
    }
    onChange(val);
  };

  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') {
      return;
    }
    checkAndUpdate(e.currentTarget.value);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    checkAndUpdate(e.currentTarget.value);
  };

  const prefix =
    inputPrefix === InputPrefix.GreaterThan ? (
      <div>&gt;</div>
    ) : inputPrefix === InputPrefix.LessThan ? (
      <div>&lt;</div>
    ) : null;

  return (
    <Input
      autoFocus={false}
      placeholder={t('timeseries.nulls-threshold-input.placeholder-never', 'Never')}
      width={10}
      defaultValue={defaultValue}
      onKeyDown={handleEnterKey}
      onBlur={handleBlur}
      prefix={prefix}
      spellCheck={false}
    />
  );
};
