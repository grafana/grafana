import React from 'react';
import { SelectableValue } from '@grafana/data';
import { Project } from '.';
import { LogsQuery } from '../types';
import StackdriverDatasource from '../datasource';

export interface Props {
  onChange: (query: LogsQuery) => void;
  onRunQuery: () => void;
  variableOptionGroup: SelectableValue<string>;
  query: LogsQuery;
  datasource: StackdriverDatasource;
}

export const defaultLogsQuery: LogsQuery = {
  projectName: '',
  filter: '',
  pageSize: 100,
  orderBy: 'timestamp desc',
};

export function LogsQueryEditor({
  query,
  datasource,
  onChange,
  onRunQuery,
  variableOptionGroup,
}: React.PropsWithChildren<Props>) {
  return (
    <>
      <Project
        templateVariableOptions={variableOptionGroup.options}
        projectName={query.projectName}
        datasource={datasource}
        onChange={projectName => onChange({ ...query, projectName })}
      />

      <textarea
        rows={7}
        value={query.filter}
        className="gf-form-input gf-form-textarea slate-query-field"
        onChange={e => onChange({ ...query, filter: e.target.value })}
        onBlur={onRunQuery}
        placeholder="Enter a Stackdriver Logging query"
        required
      />
    </>
  );
}
