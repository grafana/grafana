// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

import { InlineFormLabel, LegacyForms } from '@grafana/ui';
const { Select, FormField } = LegacyForms;
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
      rule: item.value!,
    });
  };

  onExpressionChange = (evt: ChangeEvent<any>) => {
    const { query, onChange } = this.props;
    onChange({
      ...query,
      expression: evt.target.value,
    });
  };

  onRuleChange = (evt: ChangeEvent<any>) => {
    const { query, onChange } = this.props;
    onChange({
      ...query,
      rule: evt.target.value,
    });
  };

  render() {
    const { query } = this.props;
    const selected = gelTypes.find(o => o.value === query.type);
    const reducer = reducerTypes.find(o => o.value === query.reducer);
    const downsampler = downsamplingTypes.find(o => o.value === query.downsampler);
    const upsampler = upsamplingTypes.find(o => o.value === query.upsampler);

    return (
      <div>
        <div className="form-field">
          <Select options={gelTypes} value={selected} onChange={this.onSelectGELType} />
          {query.type === GELQueryType.reduce && (
            <>
              <InlineFormLabel width={5}>Function:</InlineFormLabel>
              <Select options={reducerTypes} value={reducer} onChange={this.onSelectReducer} />
              <FormField label="Fields:" labelWidth={5} onChange={this.onExpressionChange} value={query.expression} />
            </>
          )}
        </div>
        {query.type === GELQueryType.math && (
          <textarea value={query.expression} onChange={this.onExpressionChange} className="gf-form-input" rows={2} />
        )}
        {query.type === GELQueryType.resample && (
          <>
            <div>
              <FormField label="Series:" labelWidth={5} onChange={this.onExpressionChange} value={query.expression} />
              <FormField label="Rule:" labelWidth={5} onChange={this.onRuleChange} value={query.rule} />
            </div>
            <div>
              <InlineFormLabel width={12}>Downsample Function:</InlineFormLabel>
              <Select options={downsamplingTypes} value={downsampler} onChange={this.onSelectDownsampler} />
              <InlineFormLabel width={12}>Upsample Function:</InlineFormLabel>
              <Select options={upsamplingTypes} value={upsampler} onChange={this.onSelectUpsampler} />
            </div>
          </>
        )}
      </div>
    );
  }
}
