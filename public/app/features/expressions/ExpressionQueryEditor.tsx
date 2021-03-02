// Libraries
import React, { PureComponent, ChangeEvent } from 'react';
import { css } from 'emotion';

import { InlineField, InlineFieldRow, Input, Select, TextArea } from '@grafana/ui';
import { SelectableValue, ReducerID, QueryEditorProps } from '@grafana/data';

// Types
import { ExpressionQuery, GELQueryType } from './types';
import { ExpressionDatasourceApi } from './ExpressionDatasource';

type Props = QueryEditorProps<ExpressionDatasourceApi, ExpressionQuery>;

interface State {}

const gelTypes: Array<SelectableValue<GELQueryType>> = [
  { value: GELQueryType.math, label: 'Math' },
  { value: GELQueryType.reduce, label: 'Reduce' },
  { value: GELQueryType.resample, label: 'Resample' },
];

const reducerTypes: Array<SelectableValue<string>> = [
  { value: ReducerID.min, label: 'Min', description: 'Get the minimum value' },
  { value: ReducerID.max, label: 'Max', description: 'Get the maximum value' },
  { value: ReducerID.mean, label: 'Mean', description: 'Get the average value' },
  { value: ReducerID.sum, label: 'Sum', description: 'Get the sum of all values' },
  { value: ReducerID.count, label: 'Count', description: 'Get the number of values' },
];

const downsamplingTypes: Array<SelectableValue<string>> = [
  { value: ReducerID.min, label: 'Min', description: 'Fill with the minimum value' },
  { value: ReducerID.max, label: 'Max', description: 'Fill with the maximum value' },
  { value: ReducerID.mean, label: 'Mean', description: 'Fill with the average value' },
  { value: ReducerID.sum, label: 'Sum', description: 'Fill with the sum of all values' },
];

const upsamplingTypes: Array<SelectableValue<string>> = [
  { value: 'pad', label: 'pad', description: 'fill with the last known value' },
  { value: 'backfilling', label: 'backfilling', description: 'fill with the next known value' },
  { value: 'fillna', label: 'fillna', description: 'Fill with NaNs' },
];

const mathPlaceholder =
  'Math operations on one more queries, you reference the query by ${refId} ie. $A, $B, $C etc\n' +
  'Example: $A + $B\n' +
  'Available functions: abs(), log(), nan(), inf(), null()';

export class ExpressionQueryEditor extends PureComponent<Props, State> {
  state = {};

  onSelectGELType = (item: SelectableValue<GELQueryType>) => {
    const { query, onChange } = this.props;
    const q = {
      ...query,
      type: item.value!,
    };

    if (q.type === GELQueryType.reduce) {
      if (!q.reducer) {
        q.reducer = ReducerID.mean;
      }
      q.expression = undefined;
    } else if (q.type === GELQueryType.resample) {
      if (!q.downsampler) {
        q.downsampler = ReducerID.mean;
      }
      if (!q.upsampler) {
        q.upsampler = 'fillna';
      }
      q.reducer = undefined;
    } else {
      q.reducer = undefined;
    }

    onChange(q);
  };

  onSelectReducer = (item: SelectableValue<string>) => {
    const { query, onChange } = this.props;
    onChange({
      ...query,
      reducer: item.value!,
    });
  };

  onSelectUpsampler = (item: SelectableValue<string>) => {
    const { query, onChange } = this.props;
    onChange({
      ...query,
      upsampler: item.value!,
    });
  };

  onSelectDownsampler = (item: SelectableValue<string>) => {
    const { query, onChange } = this.props;
    onChange({
      ...query,
      downsampler: item.value!,
    });
  };

  onRuleReducer = (item: SelectableValue<string>) => {
    const { query, onChange } = this.props;
    onChange({
      ...query,
      window: item.value!,
    });
  };

  onRefIdChange = (value: SelectableValue<string>) => {
    const { query, onChange } = this.props;
    onChange({
      ...query,
      expression: value.value,
    });
  };

  onExpressionChange = (evt: ChangeEvent<any>) => {
    const { query, onChange } = this.props;
    onChange({
      ...query,
      expression: evt.target.value,
    });
  };

  onWindowChange = (evt: ChangeEvent<any>) => {
    const { query, onChange } = this.props;
    onChange({
      ...query,
      window: evt.target.value,
    });
  };

  render() {
    const { query, queries } = this.props;
    const selected = gelTypes.find((o) => o.value === query.type);
    const reducer = reducerTypes.find((o) => o.value === query.reducer);
    const downsampler = downsamplingTypes.find((o) => o.value === query.downsampler);
    const upsampler = upsamplingTypes.find((o) => o.value === query.upsampler);
    const labelWidth = 14;

    const refIds = queries!.filter((q) => query.refId !== q.refId).map((q) => ({ value: q.refId, label: q.refId }));

    return (
      <div>
        <InlineField label="Operation" labelWidth={labelWidth}>
          <Select options={gelTypes} value={selected} onChange={this.onSelectGELType} width={25} />
        </InlineField>
        {query.type === GELQueryType.math && (
          <InlineField
            label="Expression"
            labelWidth={labelWidth}
            className={css`
              align-items: baseline;
            `}
          >
            <TextArea
              value={query.expression}
              onChange={this.onExpressionChange}
              rows={4}
              placeholder={mathPlaceholder}
            />
          </InlineField>
        )}
        {query.type === GELQueryType.reduce && (
          <InlineFieldRow>
            <InlineField label="Function" labelWidth={labelWidth}>
              <Select options={reducerTypes} value={reducer} onChange={this.onSelectReducer} width={25} />
            </InlineField>
            <InlineField label="Input" labelWidth={labelWidth}>
              <Select onChange={this.onRefIdChange} options={refIds} value={query.expression} width={20} />
            </InlineField>
          </InlineFieldRow>
        )}
        {query.type === GELQueryType.resample && (
          <>
            <InlineFieldRow>
              <InlineField label="Input" labelWidth={labelWidth}>
                <Select onChange={this.onRefIdChange} options={refIds} value={query.expression} width={20} />
              </InlineField>
            </InlineFieldRow>
            <InlineFieldRow>
              <InlineField label="Resample to" labelWidth={labelWidth} tooltip="10s, 1m, 30m, 1h">
                <Input onChange={this.onWindowChange} value={query.window} width={15} />
              </InlineField>
              <InlineField label="Downsample">
                <Select
                  options={downsamplingTypes}
                  value={downsampler}
                  onChange={this.onSelectDownsampler}
                  width={25}
                />
              </InlineField>
              <InlineField label="Upsample">
                <Select options={upsamplingTypes} value={upsampler} onChange={this.onSelectUpsampler} width={25} />
              </InlineField>
            </InlineFieldRow>
          </>
        )}
      </div>
    );
  }
}
