import React, { ChangeEvent } from 'react';

import { QueryEditorProps } from '@grafana/data';
import { EditorField, EditorHeader, EditorRow, EditorSwitch, InlineSelect, Space } from '@grafana/experimental';
import { Alert, Input } from '@grafana/ui';

import { CloudWatchDatasource } from '../datasource';
import { isCloudWatchAnnotationQuery } from '../guards';
import { useRegions } from '../hooks';
import { CloudWatchJsonData, CloudWatchQuery, MetricStat } from '../types';

import { MetricStatEditor } from './MetricStatEditor';

export type Props = QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData>;

export const AnnotationQueryEditor = (props: Props) => {
  const { query, onChange, datasource } = props;
  const [regions, regionIsLoading] = useRegions(datasource);

  if (!isCloudWatchAnnotationQuery(query)) {
    return (
      <Alert severity="error" title="Invalid annotation query" topSpacing={2}>
        {JSON.stringify(query, null, 4)}
      </Alert>
    );
  }

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
        refId={query.refId}
        metricStat={query}
        disableExpressions={true}
        onChange={(metricStat: MetricStat) => onChange({ ...query, ...metricStat })}
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
};
