import React, { PureComponent, ChangeEvent } from 'react';
import { SelectableValue, ReducerID, QueryEditorProps } from '@grafana/data';
import { InlineField, Select } from '@grafana/ui';
import { ExpressionDatasourceApi } from './ExpressionDatasource';
import { Resample } from './components/Resample';
import { Reduce } from './components/Reduce';
import { Math } from './components/Math';
import { ExpressionQuery, GELQueryType, gelTypes } from './types';

type Props = QueryEditorProps<ExpressionDatasourceApi, ExpressionQuery>;

export class ExpressionQueryEditor extends PureComponent<Props> {
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

  onExpressionChange = (evt: ChangeEvent<any>) => {
    const { query, onChange } = this.props;
    onChange({
      ...query,
      expression: evt.target.value,
    });
  };

  render() {
    const { onChange, query, queries } = this.props;
    const selected = gelTypes.find((o) => o.value === query.type);
    const labelWidth = 14;
    const refIds = queries!.filter((q) => query.refId !== q.refId).map((q) => ({ value: q.refId, label: q.refId }));

    return (
      <div>
        <InlineField label="Operation" labelWidth={labelWidth}>
          <Select options={gelTypes} value={selected} onChange={this.onSelectGELType} width={25} />
        </InlineField>
        {query.type === GELQueryType.math && <Math onChange={onChange} query={query} labelWidth={labelWidth} />}
        {query.type === GELQueryType.reduce && (
          <Reduce refIds={refIds} onChange={onChange} labelWidth={labelWidth} query={query} />
        )}
        {query.type === GELQueryType.resample && (
          <Resample query={query} labelWidth={labelWidth} onChange={onChange} refIds={refIds} />
        )}
      </div>
    );
  }
}
