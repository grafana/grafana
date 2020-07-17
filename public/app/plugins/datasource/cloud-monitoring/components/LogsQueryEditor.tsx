import React from 'react';
import { SelectableValue } from '@grafana/data';
import { QueryField } from '@grafana/ui';
import { Project, QueryInlineField } from '.';
import { LogsQuery } from '../types';
import CloudMonitoringDatasource from '../datasource';

export interface Props {
  onChange: (query: LogsQuery) => void;
  onRunQuery: () => void;
  variableOptionGroup: SelectableValue<string>;
  query: LogsQuery;
  datasource: CloudMonitoringDatasource;
}

export const defaultQuery: (dataSource: CloudMonitoringDatasource) => LogsQuery = dataSource => ({
  projectName: dataSource.getDefaultProject(),
  filter: '',
  pageSize: 100,
  orderBy: 'timestamp desc',
});

function Editor({ query, datasource, onChange, onRunQuery, variableOptionGroup }: React.PropsWithChildren<Props>) {
  return (
    <>
      <Project
        templateVariableOptions={variableOptionGroup.options}
        projectName={query.projectName}
        datasource={datasource}
        onChange={projectName => onChange({ ...query, projectName })}
      />

      <QueryInlineField label="Order By">
        <input
          type="text"
          className="gf-form-input width-26"
          value={query.orderBy}
          onChange={e => onChange({ ...query, orderBy: e.target.value })}
        />
      </QueryInlineField>

      <QueryInlineField label="Page Size">
        <input
          type="text"
          className="gf-form-input width-26"
          value={query.pageSize}
          onChange={e => onChange({ ...query, pageSize: parseInt(e.target.value, 10) })}
        />
      </QueryInlineField>

      <QueryField
        query={query.filter ?? ''}
        onChange={(value: string) => onChange({ ...query, filter: value })}
        onBlur={onRunQuery}
        onRunQuery={onRunQuery}
        placeholder="Enter a Cloud Logging filter"
        portalOrigin="stackdriver"
      />
    </>
  );
}

export const LogsQueryEditor = React.memo(Editor);
