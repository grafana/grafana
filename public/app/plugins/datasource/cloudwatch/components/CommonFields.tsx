import { EditorField, EditorRow } from '@grafana/experimental';
import { Input } from '@grafana/ui';
import React, { FunctionComponent, useState } from 'react';
import { ChangeEvent } from 'react';

import { CloudWatchMetricsQuery } from '../types';
import { Alias } from './Alias';

export interface Props {
  query: CloudWatchMetricsQuery;
  onRunQuery: () => void;
  onChange: (alias: any) => void;
  value: string;
}

export const CommonFields: FunctionComponent<Props> = ({ value = '', onChange, onRunQuery, query }) => {
  return (
    <EditorRow>
      <EditorField
        label="ID"
        width={26}
        optional
        tooltip="ID can be used to reference other queries in math expressions. The ID can include numbers, letters, and underscore, and must start with a lowercase letter."
      >
        <Input
          id={`${query.refId}-cloudwatch-metric-query-editor-id`}
          onBlur={onRunQuery}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            this.onChange({ ...metricsQuery, id: event.target.value })
          }
          type="text"
          invalid={!!query.id && !/^$|^[a-z][a-zA-Z0-9_]*$/.test(query.id)}
          value={query.id}
        />
      </EditorField>

      <EditorField label="Period" width={26} tooltip="Minimum interval between points in seconds.">
        <Input
          id={`${query.refId}-cloudwatch-metric-query-editor-period`}
          value={query.period || ''}
          placeholder="auto"
          onBlur={onRunQuery}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            this.onChange({ ...metricsQuery, period: event.target.value })
          }
        />
      </EditorField>

      <EditorField
        label="Alias"
        width={26}
        optional
        tooltip="Change time series legend name using this field. See documentation for replacement variable formats."
      >
        <Alias
          value={metricsQuery.alias ?? ''}
          onChange={(value: string) => this.onChange({ ...metricsQuery, alias: value })}
        />
      </EditorField>
    </EditorRow>
  );
};
