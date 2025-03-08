import React from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { JoinSettings } from '../types';

import { MathExpressionInput } from './Math';

interface JoinProps {
  labelWidth: number | 'auto';
  refIds: Array<SelectableValue<string>>;
  expression: JoinSettings;
  onChange: (query: JoinSettings) => void;
  onError?: (error: string | undefined) => void;
  onRunQuery: () => void;
}

const types: Array<SelectableValue<string>> = [
  { label: 'LEFT OUTER', value: 'outer' },
  { label: 'INNER', value: 'inner' },
];

const Join: React.FC<JoinProps> = ({ labelWidth, refIds, onError, onChange, expression, onRunQuery }) => {
  return (
    <>
      <InlineFieldRow>
        <InlineField label="Left RefID" labelWidth={labelWidth}>
          <Select
            options={refIds}
            value={expression.leftRefId}
            width={20}
            onChange={(e) => {
              onChange({ ...expression, leftRefId: e.value ?? '' });
            }}
          />
        </InlineField>
        <InlineField label="Join Type" labelWidth={labelWidth}>
          <Select
            options={types}
            value={expression.joinType}
            width="auto"
            onChange={(e) => {
              onChange({ ...expression, joinType: e.value ?? '' });
            }}
          />
        </InlineField>
        <InlineField label="Right RefID" labelWidth={labelWidth}>
          <Select
            options={refIds}
            value={expression.rightRefId}
            width={20}
            onChange={(e) => {
              onChange({ ...expression, rightRefId: e.value ?? '' });
            }}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="By Labels" labelWidth={labelWidth}>
          <Select
            allowCustomValue
            value={expression.labels.map((l) => {
              return {
                label: l,
                value: l,
              };
            })}
            onChange={(e) => {
              onChange({ ...expression, labels: e.map((v: SelectableValue) => v.value) });
            }}
            onCreateOption={(e) => {
              onChange({ ...expression, labels: expression.labels.concat(e) });
            }}
            multi={true}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <MathExpressionInput
          expression={expression.expression}
          onChange={(exp) => {
            onChange({ ...expression, expression: exp });
          }}
          labelWidth={labelWidth}
          onRunQuery={onRunQuery}
        />
      </InlineFieldRow>
    </>
  );
};

export default Join;
