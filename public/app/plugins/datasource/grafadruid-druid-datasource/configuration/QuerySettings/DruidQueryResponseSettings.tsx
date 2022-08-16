import React, { ChangeEvent } from 'react';
import { InlineFieldRow, InlineField, InlineSwitch, Select, Input } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { QuerySettingsProps } from './types';
import { DruidQueryLogSettings } from './DruidQueryLogSettings';

export const DruidQueryResponseSettings = (props: QuerySettingsProps) => {
  const { options, onOptionsChange } = props;
  const { settings } = options;
  const formatSelectOptions: Array<SelectableValue<string>> = [
    { label: 'Long', value: 'long' },
    { label: 'Wide', value: 'wide' },
    { label: 'Log', value: 'log' },
  ];
  const selectFormatOptionByValue = (value?: string): SelectableValue<string> | undefined => {
    if (undefined === value) {
      return undefined;
    }
    const options = formatSelectOptions.filter((option) => option.value === value);
    return options.length > 0 ? options[0] : undefined;
  };
  const onFormatSelectionChange = (option: SelectableValue<string>) => {
    onOptionsChange({ ...options, settings: { ...settings, format: option.value } });
  };
  const onHideEmptyColumnsChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({ ...options, settings: { ...settings, hideEmptyColumns: event!.currentTarget.checked } });
  };
  const onResponseLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({ ...options, settings: { ...settings, responseLimit: Number(event.target.value) } });
  };
  return (
    <>
      <InlineFieldRow>
        <InlineField label="Format" tooltip="Changes the data frame format used to return results">
          <Select
            onChange={onFormatSelectionChange}
            options={formatSelectOptions}
            value={selectFormatOptionByValue(settings.format)}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Response Limit" tooltip="Limit the response rows to prevent browser overload">
          <Input
            type="number"
            placeholder="Rows limit number. e.g: 1000"
            value={settings.responseLimit}
            onChange={onResponseLimitChange}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label="Hide empty columns"
          tooltip="Hide columns from the response where no row has a value for those columns"
        >
          <InlineSwitch value={settings.hideEmptyColumns} onChange={onHideEmptyColumnsChange} />
        </InlineField>
      </InlineFieldRow>
      {settings.format === 'log' && (
        <InlineFieldRow>
          <DruidQueryLogSettings {...props} />
        </InlineFieldRow>
      )}
    </>
  );
};
