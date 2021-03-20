import React from 'react';
import { FieldOverrideEditorProps, rangeUtil, SelectableValue } from '@grafana/data';
import { HorizontalGroup, Input, RadioButtonGroup } from '@grafana/ui';
import { secondsToHms } from '@grafana/data/src/datetime/rangeutil';

const GAPS_OPTIONS: Array<SelectableValue<boolean>> = [
  {
    label: 'Gaps',
    value: false,
  },
  {
    label: 'Connected',
    value: true,
  },
];

export const SpanNullsEditor: React.FC<FieldOverrideEditorProps<boolean | number, any>> = ({ value, onChange }) => {
  const isNumber = typeof value === 'number';
  const isConnected = value === true || isNumber;
  const formattedTime = isNumber ? secondsToHms(value as number) : undefined;

  const checkAndUpdate = (txt: string) => {
    if (txt) {
      try {
        onChange(rangeUtil.intervalToSeconds(txt));
      } catch (err) {
        console.warn('ERROR', err);
      }
    } else {
      onChange(true); // nothing special
    }
  };

  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') {
      return;
    }
    checkAndUpdate((e.target as any).value);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    checkAndUpdate(e.target.value);
  };

  console.log('SPAN null', { isNumber, isConnected, value });
  return (
    <HorizontalGroup>
      <RadioButtonGroup value={isConnected} options={GAPS_OPTIONS} onChange={onChange} />
      {isConnected && (
        <Input placeholder="always" defaultValue={formattedTime} onKeyDown={handleEnterKey} onBlur={handleBlur} />
      )}
    </HorizontalGroup>
  );
};
