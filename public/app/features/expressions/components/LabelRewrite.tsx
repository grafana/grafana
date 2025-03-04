import React from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { StringArrayInput } from '../../alerting/unified/components/receivers/form/fields/StringArrayInput';
import { ExpressionQuery } from '../types';

import { LabelAddInput } from './LabelAddInput';
import { LabelReplaceInput } from './LabelReplaceInput';

interface LabelRewriteProps {
  labelWidth?: number | 'auto';
  refIds: Array<SelectableValue<string>>;
  expression: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
  onError?: (error: string | undefined) => void;
}

const LabelRewrite: React.FC<LabelRewriteProps> = ({ labelWidth, refIds, onError, onChange, expression }) => {
  const onRefIdChange = (value: SelectableValue<string>) => {
    onChange({ ...expression, expression: value.value });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="input" labelWidth={labelWidth}>
          <Select options={refIds} value={expression.expression} width={20} onChange={onRefIdChange} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Add" grow>
          <LabelAddInput
            value={expression.labelRewrite?.add}
            onChange={(e) => {
              onChange({ ...expression, labelRewrite: { ...expression.labelRewrite, add: e } });
            }}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Replace" grow>
          <LabelReplaceInput
            value={expression.labelRewrite?.replace}
            onChange={(e) => {
              onChange({ ...expression, labelRewrite: { ...expression.labelRewrite, replace: e } });
            }}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Remove" grow>
          <StringArrayInput
            value={expression.labelRewrite?.remove}
            onChange={(e) => {
              onChange({ ...expression, labelRewrite: { ...expression.labelRewrite, remove: e } });
            }}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};

export default LabelRewrite;
