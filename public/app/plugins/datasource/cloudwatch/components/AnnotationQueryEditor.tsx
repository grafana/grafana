import { PanelData } from '@grafana/data';
import { EditorField, EditorHeader, EditorRow, InlineSelect, Space } from '@grafana/experimental';
import { Input, Switch } from '@grafana/ui';
import React, { ChangeEvent } from 'react';

import { CloudWatchDatasource } from '../datasource';
import { useRegions } from '../hooks';
import { CloudWatchAnnotationQuery, CloudWatchMetricsQuery, CloudWatchQuery } from '../types';
import { MetricStatEditor } from './MetricStatEditor';

// datasource: DSType;
// query: TVQuery;
// onRunQuery: () => void;
// onChange: (value: TVQuery) => void;

export type Props = {
  query: CloudWatchQuery;
  datasource: CloudWatchDatasource;
  onChange: (value: CloudWatchQuery) => void;
  data?: PanelData;
};

export function AnnotationQueryEditor(props: React.PropsWithChildren<Props>) {
  const { query, onChange, datasource } = props;
  const annotationQuery = query as CloudWatchAnnotationQuery;
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
        query={annotationQuery}
        disableExpressions={true}
        onChange={(editorQuery: CloudWatchMetricsQuery) => onChange({ ...annotationQuery, ...editorQuery })}
        onRunQuery={() => {}}
      ></MetricStatEditor>
      <Space v={0.5} />
      <EditorRow>
        <EditorField label="Period" width={26} tooltip="Minimum interval between points in seconds.">
          <Input
            value={annotationQuery.period || ''}
            placeholder="auto"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange({ ...annotationQuery, period: event.target.value })
            }
          />
        </EditorField>
        <EditorField label="Enable Prefix Matching" optional={true}>
          <Switch
            value={annotationQuery.prefixMatching}
            onChange={(e) => {
              onChange({
                ...annotationQuery,
                prefixMatching: e.currentTarget.checked,
              });
            }}
          />
        </EditorField>
        <EditorField label="Action" optional={true}>
          <Input
            disabled={!annotationQuery.prefixMatching}
            value={annotationQuery.actionPrefix || ''}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange({ ...annotationQuery, actionPrefix: event.target.value })
            }
          />
        </EditorField>
        <EditorField label="Alarm Name" optional={true}>
          <Input
            disabled={!annotationQuery.prefixMatching}
            value={annotationQuery.alarmNamePrefix || ''}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange({ ...annotationQuery, alarmNamePrefix: event.target.value })
            }
          />
        </EditorField>
      </EditorRow>
    </>
  );
}
