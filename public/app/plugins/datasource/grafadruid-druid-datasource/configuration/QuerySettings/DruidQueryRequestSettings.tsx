import React, { ChangeEvent } from 'react';
import { InlineFieldRow, InlineField, Input } from '@grafana/ui';
import { QuerySettingsProps } from './types';
import { DruidQueryContextSettings } from './DruidQueryContextSettings';

export const DruidQueryRequestSettings = (props: QuerySettingsProps) => {
  const { options, onOptionsChange } = props;
  const { settings } = options;
  const onDebounceTimeChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({ ...options, settings: { ...settings, debounceTime: Number(event.target.value) } });
  };
  return (
    <>
      <InlineFieldRow>
        <DruidQueryContextSettings {...props} />
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Debounce Time" tooltip="Milliseconds to wait before autosubmitting query">
          <Input
            type="number"
            placeholder="Debounce time in milliseconds. e.g: 250"
            value={settings.debounceTime}
            onChange={onDebounceTimeChange}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
