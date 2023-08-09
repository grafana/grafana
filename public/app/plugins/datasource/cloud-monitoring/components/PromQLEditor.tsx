import React from 'react';
import { css, cx } from '@emotion/css';

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
  query: "",
  step: 10,
});

export function PromQLQueryEditor({
  refId,
  query,
  datasource,
  onChange,
  variableOptionGroup,
  onRunQuery,
}: React.PropsWithChildren<Props>) {

  function onChangeQueryStep(interval: number) {
    onChange({ ...query, step: interval });
  }

  function onStepChange(e: React.SyntheticEvent<HTMLInputElement>) {
    if (e.currentTarget.value !== query.step.toString()) {
      onChangeQueryStep(+e.currentTarget.value);
    }
  }

  function onReturnKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && e.shiftKey) {
      onRunQuery();
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
          value={query.query}
          rows={10}
          placeholder="Enter a Cloud Monitoring MQL query (Run with Shift+Enter)"
          onBlur={onRunQuery}
          onChange={(e) => onChange({query: e.currentTarget.value} as PromQLQuery)}
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
            'Time units and built-in variables can be used here, for example: $__interval, $__rate_interval, 5s, 1m, 3h, 1d, 1y (Default if no unit is specified: s)'
          }
        >
          Min step
        </InlineFormLabel>
        <input
          type={'number'}
          className="gf-form-input width-4"
          placeholder={'auto'}
          onChange={onStepChange}
          onKeyDown={onReturnKeyDown}
          value={query.step ?? ''}
        />
      </div>
      </EditorRow>
    </>
  );
}
