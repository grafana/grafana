// Libraries
import React, { memo } from 'react';

// Types
import { QueryEditorProps } from '@grafana/data';
import { InlineFormLabel } from '@grafana/ui';
import { LokiDatasource } from '../datasource';
import { LokiQuery, LokiOptions } from '../types';
import { LokiQueryField } from './LokiQueryField';

type Props = QueryEditorProps<LokiDatasource, LokiQuery, LokiOptions>;

export function LokiQueryEditor(props: Props) {
  const { range, query, data, datasource, onChange, onRunQuery } = props;

  const onLegendChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const nextQuery = { ...query, legendFormat: e.currentTarget.value };
    onChange(nextQuery);
  };

  const legendField = (
    <div className="gf-form-inline">
      <div className="gf-form">
        <InlineFormLabel
          width={6}
          tooltip="Controls the name of the time series, using name or pattern. For example
        {{hostname}} will be replaced with label value for the label hostname. The legend only applies to metric queries."
        >
          Legend
        </InlineFormLabel>
        <input
          type="text"
          className="gf-form-input"
          placeholder="legend format"
          value={query.legendFormat || ''}
          onChange={onLegendChange}
          onBlur={onRunQuery}
        />
      </div>
    </div>
  );

  return (
    <LokiQueryField
      datasource={datasource}
      query={query}
      onChange={onChange}
      onRunQuery={onRunQuery}
      onBlur={onRunQuery}
      history={[]}
      data={data}
      range={range}
      runOnBlur={true}
      ExtraFieldElement={legendField}
    />
  );
}

export default memo(LokiQueryEditor);
