import React, { ChangeEvent } from 'react';

import { PanelData } from '@grafana/data';
import { EditorField, EditorHeader, EditorRow, EditorSwitch, InlineSelect, Space } from '@grafana/experimental';
import { Input } from '@grafana/ui';

import { CloudWatchDatasource } from '../datasource';
import { useRegions } from '../hooks';
import { CloudWatchAnnotationQuery, CloudWatchMetricsQuery } from '../types';

import { MetricStatEditor } from './MetricStatEditor';

export type Props = {
  query: CloudWatchAnnotationQuery;
  datasource: CloudWatchDatasource;
  onChange: (value: CloudWatchAnnotationQuery) => void;
  data?: PanelData;
};

export function AnnotationQueryEditor(props: React.PropsWithChildren<Props>) {
  const { query, onChange, datasource } = props;

  const [regions, regionIsLoading] = useRegions(datasource);

  return (
    <>
      <EditorHeader>
        <InlineSelect
          label="Region"
          value={regions.find((v) => v.value === query.region)}
          placeholder="Select region"
          allowCustomValue
          onChange={({ value: region }) => region && onChange({ ...query, region })}
          options={regions}
          isLoading={regionIsLoading}
        />
      </EditorHeader>
      <Space v={0.5} />
      <MetricStatEditor
        {...props}
        disableExpressions={true}
        onChange={(editorQuery: CloudWatchMetricsQuery) => onChange({ ...query, ...editorQuery })}
        onRunQuery={() => {}}
      ></MetricStatEditor>
      <Space v={0.5} />
      <EditorRow>
        <EditorField label="Period" width={26} tooltip="Minimum interval between points in seconds.">
          <Input
            value={query.period || ''}
            placeholder="auto"
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...query, period: event.target.value })}
          />
        </EditorField>
        <EditorField label="Enable Prefix Matching" optional={true}>
          <EditorSwitch
            value={query.prefixMatching}
            onChange={(e) => {
              onChange({
                ...query,
                prefixMatching: e.currentTarget.checked,
              });
            }}
          />
        </EditorField>
        <EditorField label="Action" optional={true} disabled={!query.prefixMatching}>
          <Input
            value={query.actionPrefix || ''}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange({ ...query, actionPrefix: event.target.value })
            }
          />
        </EditorField>
        <EditorField label="Alarm Name" optional={true} disabled={!query.prefixMatching}>
          <Input
            value={query.alarmNamePrefix || ''}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange({ ...query, alarmNamePrefix: event.target.value })
            }
          />
        </EditorField>
      </EditorRow>
    </>
  );
}
