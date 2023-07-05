import React from 'react';

import { rangeUtil } from '@grafana/data';
import { Input } from '@grafana/ui';

export enum InputPrefix {
  LessThan = 'lessthan',
  GreaterThan = 'greaterthan',
}

type Props = { value: number; onChange: (value?: number | boolean | undefined) => void; inputPrefix?: InputPrefix };

export const NullsThresholdInput = ({ value, onChange, inputPrefix }: Props) => {
  const formattedTime = rangeUtil.secondsToHms(value / 1000);
  const checkAndUpdate = (txt: string) => {
    let val: boolean | number = false;
    if (txt) {
      try {
        val = rangeUtil.intervalToMs(txt);
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
      placeholder="never"
      width={10}
      defaultValue={formattedTime}
      onKeyDown={handleEnterKey}
      onBlur={handleBlur}
      prefix={prefix}
      spellCheck={false}
    />
  );
};
