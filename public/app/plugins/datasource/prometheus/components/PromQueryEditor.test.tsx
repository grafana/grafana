import { screen, render } from '@testing-library/react';
import React from 'react';

import { dateTime, CoreApp } from '@grafana/data';

import { PrometheusDatasource } from '../datasource';
import { PromQuery } from '../types';

import { PromQueryEditor, testIds } from './PromQueryEditor';

jest.mock('app/features/dashboard/services/TimeSrv', () => {
  return {
    getTimeSrv: () => ({
      timeRange: () => ({
        from: dateTime(),
        to: dateTime(),
      }),
    }),
  };
});

jest.mock('./monaco-query-field/MonacoQueryFieldWrapper', () => {
  const fakeQueryField = () => <div>prometheus query field</div>;
  return {
    MonacoQueryFieldWrapper: fakeQueryField,
  };
});

const setup = (propOverrides?: object) => {
  const datasourceMock: unknown = {
    createQuery: jest.fn((q) => q),
    getPrometheusTime: jest.fn((date, roundup) => 123),
    languageProvider: {
      start: () => Promise.resolve([]),
      syntax: () => {},
      getLabelKeys: () => [],
      metrics: [],
    },
    getInitHints: () => [],
  };
  const datasource: PrometheusDatasource = datasourceMock as PrometheusDatasource;
  const onRunQuery = jest.fn();
  const onChange = jest.fn();
  const query: PromQuery = { expr: '', refId: 'A' };

  const props: any = {
    datasource,
    onChange,
    onRunQuery,
    query,
  };

  Object.assign(props, propOverrides);

  return render(<PromQueryEditor {...props} />);
};

describe('Render PromQueryEditor with basic options', () => {
  it('should render editor', () => {
    setup();
    expect(screen.getByTestId(testIds.editor)).toBeInTheDocument();
  });

  it('should render exemplar editor for dashboard', () => {
    setup({ app: CoreApp.Dashboard });
    expect(screen.getByTestId(testIds.editor)).toBeInTheDocument();
    expect(screen.getByTestId(testIds.exemplar)).toBeInTheDocument();
  });

  it('should not render exemplar editor for unified alerting', () => {
    setup({ app: CoreApp.UnifiedAlerting });
    expect(screen.getByTestId(testIds.editor)).toBeInTheDocument();
    expect(screen.queryByTestId(testIds.exemplar)).not.toBeInTheDocument();
  });
});
