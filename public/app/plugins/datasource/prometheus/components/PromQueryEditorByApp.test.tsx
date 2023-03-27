import { render, screen } from '@testing-library/react';
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

function setup(app: CoreApp): { onRunQuery: jest.Mock } {
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

  render(
    <PromQueryEditorByApp
      app={app}
      onChange={noop}
      onRunQuery={onRunQuery}
      datasource={dataSource}
      query={{ refId: 'A', expr: '' }}
    />
  );

  return {
    onRunQuery,
  };
}

describe('PromQueryEditorByApp', () => {
  it('should render simplified query editor for cloud alerting', async () => {
    setup(CoreApp.CloudAlerting);

    expect(await screen.findByTestId(alertingTestIds.editor)).toBeInTheDocument();
  });

  it('should render editor selector for unkown apps', () => {
    setup(CoreApp.Unknown);

    expect(screen.getByTestId('QueryEditorModeToggle')).toBeInTheDocument();
    expect(screen.queryByTestId(alertingTestIds.editor)).toBeNull();
  });

  it('should render editor selector for explore', () => {
    setup(CoreApp.Explore);

    expect(screen.getByTestId('QueryEditorModeToggle')).toBeInTheDocument();
    expect(screen.queryByTestId(alertingTestIds.editor)).toBeNull();
  });

  it('should render editor selector for dashboard', () => {
    setup(CoreApp.Dashboard);

    expect(screen.getByTestId('QueryEditorModeToggle')).toBeInTheDocument();
    expect(screen.queryByTestId(alertingTestIds.editor)).toBeNull();
  });
});
