// Libraries
import React from 'react';

// Types
import { InlineFormLabel } from '@grafana/ui';
import { LokiQueryField } from './LokiQueryField';
import { LokiOptionFields } from './LokiOptionFields';
import { LokiQueryEditorProps } from './types';

export function LokiQueryEditor(props: LokiQueryEditorProps) {
  const { query, data, datasource, onChange, onRunQuery, range } = props;

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
      data-testid={testIds.editor}
      range={range}
      ExtraFieldElement={
        <>
          <LokiOptionFields
            queryType={query.instant ? 'instant' : 'range'}
            lineLimitValue={query?.maxLines?.toString() || ''}
            resolution={query?.resolution || 1}
            query={query}
            onRunQuery={onRunQuery}
            onChange={onChange}
            runOnBlur={true}
          />
          {legendField}
        </>
      }
    />
  );
}

export const testIds = {
  editor: 'loki-editor',
};
