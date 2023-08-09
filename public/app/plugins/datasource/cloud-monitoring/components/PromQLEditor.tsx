import React from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorRow } from '@grafana/experimental';
import { TextArea } from '@grafana/ui';

import CloudMonitoringDatasource from '../datasource';
import { PromQLQuery } from '../types/query';

import { Project } from './Project';

export interface Props {
  refId: string;
  variableOptionGroup: SelectableValue<string>;
  onChange: (query: PromQLQuery) => void;
  onRunQuery: () => void;
  query: PromQLQuery;
  datasource: CloudMonitoringDatasource;
}

export const defaultQuery: (dataSource: CloudMonitoringDatasource) => PromQLQuery = (dataSource) => ({
  projectName: dataSource.getDefaultProject(),
  query: "",
});

export function PromQLQueryEditor({
  refId,
  query,
  datasource,
  onChange,
  variableOptionGroup,
  onRunQuery,
}: React.PropsWithChildren<Props>) {
  return (
    <>
      <EditorRow>
        <Project
          refId={refId}
          templateVariableOptions={variableOptionGroup.options}
          projectName={query.projectName}
          datasource={datasource}
          onChange={(projectName) => onChange({ ...query, projectName })}
        />
        <TextArea
          name="Query"
          className="slate-query-field"
          value={query.query}
          rows={10}
          placeholder="Enter a Cloud Monitoring MQL query (Run with Shift+Enter)"
          onBlur={onRunQuery}
          onChange={(e) => onChange({query: e.currentTarget.value} as PromQLQuery)}
        />
      </EditorRow>
    </>
  );
}
