import React, { ChangeEvent } from 'react';
import { LegacyForms, SegmentAsync, Input } from '@grafana/ui';
const { Switch } = LegacyForms;
import { CloudWatchAnnotationQuery, CloudWatchMetricsQuery } from '../types';
import { PanelData, toOption } from '@grafana/data';
import { CloudWatchDatasource } from '../datasource';
import { QueryField, QueryInlineField } from './';
import { MetricStatEditor } from './MetricStatEditor/';

export type Props = {
  query: CloudWatchAnnotationQuery;
  datasource: CloudWatchDatasource;
  onChange: (value: CloudWatchAnnotationQuery) => void;
  data?: PanelData;
};

export function AnnotationQueryEditor(props: React.PropsWithChildren<Props>) {
  const { query, onChange, datasource } = props;

  const variableOptionGroup = {
    label: 'Template Variables',
    options: datasource.getVariables().map(toOption),
  };

  return (
    <>
      <QueryInlineField label="Region">
        <SegmentAsync
          value={query.region}
          placeholder="Select region"
          loadOptions={() =>
            datasource.metricFindQuery('regions()').then((regions) => [...regions, variableOptionGroup])
          }
          allowCustomValue
          onChange={({ value: region }) => {
            if (region) {
              onChange({ ...query, region });
            }
          }}
        />
      </QueryInlineField>
      <MetricStatEditor
        {...props}
        onChange={(editorQuery: CloudWatchMetricsQuery) => onChange({ ...query, ...editorQuery })}
        onRunQuery={() => {}}
      ></MetricStatEditor>

      <QueryInlineField label="Period" tooltip="Minimum interval between points in seconds">
        <Input
          className="width-6"
          value={query.period || ''}
          placeholder="auto"
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...query, period: event.target.value })}
        />
      </QueryInlineField>
      <div className="gf-form-inline">
        <Switch
          label="Enable Prefix Matching"
          labelClass="query-keyword"
          checked={query.prefixMatching}
          onChange={() => onChange({ ...query, prefixMatching: !query.prefixMatching })}
        />

        <div className="gf-form gf-form--grow">
          <QueryField label="Action">
            <input
              disabled={!query.prefixMatching}
              className="gf-form-input width-12"
              value={query.actionPrefix || ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onChange({ ...query, actionPrefix: event.target.value })
              }
            />
          </QueryField>
          <QueryField label="Alarm Name">
            <input
              disabled={!query.prefixMatching}
              className="gf-form-input width-12"
              value={query.alarmNamePrefix || ''}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onChange({ ...query, alarmNamePrefix: event.target.value })
              }
            />
          </QueryField>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div>
      </div>
    </>
  );
}
