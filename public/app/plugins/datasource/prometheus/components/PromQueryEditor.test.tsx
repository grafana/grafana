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
    pluginVersion: '9.0.0',
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

  it('should add pluginVersion to new queries', () => {
    const onChange = jest.fn();
    setup({ app: CoreApp.Dashboard, onChange, query: { expr: null, refId: 'A' } });
    expect(screen.getByTestId(testIds.editor)).toBeInTheDocument();
    expect(screen.getByTestId(testIds.exemplar)).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith({
      exemplar: false,
      expr: null,
      hide: undefined,
      interval: '',
      legendFormat: '',
      refId: 'A',
      pluginVersion: '9.0.0',
    });
  });

  it('should not add pluginVersion to existing queries', () => {
    const onChange = jest.fn();
    setup({ app: CoreApp.Dashboard, onChange, query: { expr: 'ALERTS{}', refId: 'A' } });
    expect(screen.getByTestId(testIds.editor)).toBeInTheDocument();
    expect(screen.getByTestId(testIds.exemplar)).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith({
      exemplar: false,
      expr: 'ALERTS{}',
      hide: undefined,
      interval: '',
      legendFormat: '',
      refId: 'A',
    });
  });
});
