import React, { FC } from 'react';
import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import { ExpressionQuery, ExpressionQuerySettings, NoneMode, reducerMode, reducerTypes, ReplaceNNMode } from '../types';

interface Props {
  labelWidth: number;
  refIds: Array<SelectableValue<string>>;
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
}

export const Reduce: FC<Props> = ({ labelWidth, onChange, refIds, query }) => {
  const reducer = reducerTypes.find((o) => o.value === query.reducer);

  const onRefIdChange = (value: SelectableValue<string>) => {
    onChange({ ...query, expression: value.value });
  };

  const onSelectReducer = (value: SelectableValue<string>) => {
    onChange({ ...query, reducer: value.value });
  };

  const onSettingsChanged = (settings: ExpressionQuerySettings) => {
    onChange({ ...query, settings: settings });
  };

  const onModeChanged = (value: SelectableValue<string>) => {
    let newSettings: ExpressionQuerySettings;
    switch (value.value) {
      case ReplaceNNMode:
        let replaceWithNumber = 0;
        if (query.settings?.mode === ReplaceNNMode) {
          replaceWithNumber = query.settings?.replaceWithValue ?? 0;
        }
        newSettings = {
          mode: ReplaceNNMode,
          replaceWithValue: replaceWithNumber,
        };
        break;
      default:
        newSettings = {
          mode: value.value,
        };
    }
    onSettingsChanged(newSettings);
  };

  const onReplaceWithChanged = (e: React.FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget.valueAsNumber;
    onSettingsChanged({ mode: ReplaceNNMode, replaceWithValue: value ?? 0 });
  };

  //TODO what if unknown mode?
  const mode = query.settings?.mode ?? NoneMode;

  const replaceWithNumber = () => {
    if (mode !== ReplaceNNMode) {
      return;
    }
    return (
      <InlineField label="Replace With" labelWidth={labelWidth}>
        <Input type="number" width={10} onChange={onReplaceWithChanged} value={query.settings?.replaceWithValue ?? 0} />
      </InlineField>
    );
  };

  return (
    <InlineFieldRow>
      <InlineField label="Function" labelWidth={labelWidth}>
        <Select menuShouldPortal options={reducerTypes} value={reducer} onChange={onSelectReducer} width={25} />
      </InlineField>
      <InlineField label="Input" labelWidth={labelWidth}>
        <Select menuShouldPortal onChange={onRefIdChange} options={refIds} value={query.expression} width={20} />
      </InlineField>
      <InlineField label="Mode" labelWidth={labelWidth}>
        <Select menuShouldPortal onChange={onModeChanged} options={reducerMode} value={mode} width={25} />
      </InlineField>
      {replaceWithNumber()}
    </InlineFieldRow>
  );
};
