import { css, cx } from '@emotion/css';
import React from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorRow } from '@grafana/experimental';
import { TextArea, InlineFormLabel } from '@grafana/ui';

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
  expr: '',
  step: '10s',
});

export function PromQLQueryEditor({
  refId,
  query,
  datasource,
  onChange,
  variableOptionGroup,
  onRunQuery,
}: React.PropsWithChildren<Props>) {
  function onReturnKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && e.shiftKey) {
      onRunQuery();
      e.preventDefault();
      e.stopPropagation();
    }
  }

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
          value={query.expr}
          rows={10}
          placeholder="Enter a Cloud Monitoring Prometheus query (Run with Shift+Enter)"
          onBlur={onRunQuery}
          onKeyDown={onReturnKeyDown}
          onChange={(e) => onChange({ ...query, expr: e.currentTarget.value })}
        />
        <div
          className={cx(
            'gf-form',
            css`
              flex-wrap: nowrap;
            `
          )}
          aria-label="Step field"
        >
          <InlineFormLabel
            width={6}
            tooltip={
              'Time units and built-in variables can be used here, for example: $__interval, $__rate_interval, 5s, 1m, 3h, 1d, 1y (Default if no unit is specified: 10s)'
            }
          >
            Min step
          </InlineFormLabel>
          <input
            type={'string'}
            className="gf-form-input width-4"
            placeholder={'auto'}
            onChange={(e) => onChange({ ...query, step: e.currentTarget.value })}
            onKeyDown={onReturnKeyDown}
            value={query.step ?? ''}
          />
        </div>
      </EditorRow>
    </>
  );
}
