import React from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { ExpressionQuery } from '../types';

interface MergeProps {
  labelWidth?: number | 'auto';
  refIds: Array<SelectableValue<string>>;
  expression: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
  onError?: (error: string | undefined) => void;
}

const types: Array<SelectableValue<string>> = [{ label: 'Drop Duplicates', value: 'drop' }];

const Merge: React.FC<MergeProps> = ({ labelWidth, refIds, onError, onChange, expression }) => {
  return (
    <>
      <InlineFieldRow>
        <InlineField label="input" labelWidth={labelWidth}>
          <Select
            onChange={(e) => {
              onChange({
                ...expression,
                merge: {
                  refids: e.map((v: SelectableValue) => v.value),
                  resolution: expression.merge?.resolution ?? 'drop',
                },
              });
            }}
            options={refIds}
            isMulti={true}
            value={expression.merge?.refids}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Add" grow>
          <Select
            options={types}
            value={expression.merge?.resolution ?? 'drop'}
            onChange={(e) => {
              onChange({
                ...expression,
                merge: { refids: expression.merge?.refids ?? [], resolution: e.value ?? 'drop' },
              });
            }}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};

export default Merge;
