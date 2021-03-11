import React, { PureComponent, ChangeEvent } from 'react';
import { SelectableValue, QueryEditorProps, ReducerID } from '@grafana/data';
import { InlineField, Select } from '@grafana/ui';
import { ExpressionDatasourceApi } from './ExpressionDatasource';
import { Resample } from './components/Resample';
import { Reduce } from './components/Reduce';
import { Math } from './components/Math';
import { ExpressionQuery, GELQueryType, gelTypes } from './types';
import { getDefaults } from './utils/expressionTypes';

type Props = QueryEditorProps<ExpressionDatasourceApi, ExpressionQuery>;

const labelWidth = 14;
export class ExpressionQueryEditor extends PureComponent<Props> {
  onSelectGELType = (item: SelectableValue<GELQueryType>) => {
    const { query, onChange } = this.props;

    const changedQuery = {
      ...getDefaults(query),
      type: item.value!,
    };

    onChange(changedQuery);
  };

  onExpressionChange = (evt: ChangeEvent<any>) => {
    const { query, onChange } = this.props;
    onChange({
      ...query,
      expression: evt.target.value,
    });
  };

  renderExpressionType() {
    const { onChange, query, queries } = this.props;
    const refIds = queries!.filter((q) => query.refId !== q.refId).map((q) => ({ value: q.refId, label: q.refId }));

    switch (query.type) {
      case GELQueryType.math:
        return <Math onChange={onChange} query={query} labelWidth={labelWidth} />;

      case GELQueryType.reduce:
        return <Reduce refIds={refIds} onChange={onChange} labelWidth={labelWidth} query={query} />;

      case GELQueryType.resample:
        return <Resample query={query} labelWidth={labelWidth} onChange={onChange} refIds={refIds} />;

      case GELQueryType.classic:
        return null;
    }
  }

  render() {
    const { query } = this.props;
    const selected = gelTypes.find((o) => o.value === query.type);

    return (
      <div>
        <InlineField label="Operation" labelWidth={labelWidth}>
          <Select options={gelTypes} value={selected} onChange={this.onSelectGELType} width={25} />
        </InlineField>
        {this.renderExpressionType()}
      </div>
    );
  }
}
