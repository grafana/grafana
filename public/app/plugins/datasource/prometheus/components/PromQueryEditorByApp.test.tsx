import { render, RenderResult } from '@testing-library/react';
import { noop } from 'lodash';
import React from 'react';

import { CoreApp } from '@grafana/data';

import { PrometheusDatasource } from '../datasource';

import { PromQueryEditorByApp } from './PromQueryEditorByApp';
import { testIds as alertingTestIds } from './PromQueryEditorForAlerting';
import { Props } from './monaco-query-field/MonacoQueryFieldProps';

// the monaco-based editor uses lazy-loading and that does not work
// well with this test, and we do not need the monaco-related
// functionality in this test anyway, so we mock it out.
jest.mock('./monaco-query-field/MonacoQueryFieldLazy', () => {
  const fakeQueryField = (props: Props) => {
    return <input onBlur={(e) => props.onBlur(e.currentTarget.value)} data-testid={'dummy-code-input'} type={'text'} />;
  };
  return {
    MonacoQueryFieldLazy: fakeQueryField,
  };
});

function setup(app: CoreApp): RenderResult & { onRunQuery: jest.Mock } {
  const dataSource = {
    createQuery: jest.fn((q) => q),
    getInitHints: () => [],
    getPrometheusTime: jest.fn((date, roundup) => 123),
    getQueryHints: jest.fn(() => []),
    languageProvider: {
      start: () => Promise.resolve([]),
      syntax: () => {},
      getLabelKeys: () => [],
      metrics: [],
    },
  } as unknown as PrometheusDatasource;
  const onRunQuery = jest.fn();

  const renderOutput = render(
    <PromQueryEditorByApp
      app={app}
      onChange={noop}
      onRunQuery={onRunQuery}
      datasource={dataSource}
      query={{ refId: 'A', expr: '' }}
    />
  );

  return {
    ...renderOutput,
    onRunQuery,
  };
}

describe('PromQueryEditorByApp', () => {
  it('should render simplified query editor for cloud alerting', () => {
    const { getByTestId } = setup(CoreApp.CloudAlerting);

    expect(getByTestId(alertingTestIds.editor)).toBeInTheDocument();
  });

  it('should render editor selector for unkown apps', () => {
    const { getByTestId, queryByTestId } = setup(CoreApp.Unknown);

    expect(getByTestId('QueryEditorModeToggle')).toBeInTheDocument();
    expect(queryByTestId(alertingTestIds.editor)).toBeNull();
  });

  it('should render editor selector for explore', () => {
    const { getByTestId, queryByTestId } = setup(CoreApp.Explore);

    expect(getByTestId('QueryEditorModeToggle')).toBeInTheDocument();
    expect(queryByTestId(alertingTestIds.editor)).toBeNull();
  });

  it('should render editor selector for dashboard', () => {
    const { getByTestId, queryByTestId } = setup(CoreApp.Dashboard);

    expect(getByTestId('QueryEditorModeToggle')).toBeInTheDocument();
    expect(queryByTestId(alertingTestIds.editor)).toBeNull();
  });
});
