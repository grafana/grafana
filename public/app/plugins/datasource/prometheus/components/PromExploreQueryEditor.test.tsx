import { render, screen } from '@testing-library/react';
import React from 'react';

import { LoadingState, PanelData, toUtc, TimeRange } from '@grafana/data';

import { PrometheusDatasource } from '../datasource';
import { PromQuery } from '../types';

import { testIds as extraFieldTestIds } from './PromExploreExtraField';
import { PromExploreQueryEditor, testIds } from './PromExploreQueryEditor';

// the monaco-based editor uses lazy-loading and that does not work
// well with this test, and we do not need the monaco-related
// functionality in this test anyway, so we mock it out.
jest.mock('./monaco-query-field/MonacoQueryFieldWrapper', () => {
  const fakeQueryField = () => <div>prometheus query field</div>;
  return {
    MonacoQueryFieldWrapper: fakeQueryField,
  };
});

const setup = (propOverrides?: object) => {
  const datasourceMock: unknown = {
    languageProvider: {
      syntax: () => {},
      getLabelKeys: () => [],
      metrics: [],
      start: () => Promise.resolve([]),
    },
    getInitHints: () => [],
    exemplarsAvailable: true,
  };
  const datasource: PrometheusDatasource = datasourceMock as PrometheusDatasource;
  const onRunQuery = jest.fn();
  const onChange = jest.fn();
  const query: PromQuery = { expr: '', refId: 'A', interval: '1s', exemplar: true };
  const range: TimeRange = {
    from: toUtc('2020-01-01', 'YYYY-MM-DD'),
    to: toUtc('2020-01-02', 'YYYY-MM-DD'),
    raw: {
      from: toUtc('2020-01-01', 'YYYY-MM-DD'),
      to: toUtc('2020-01-02', 'YYYY-MM-DD'),
    },
  };
  const data: PanelData = {
    state: LoadingState.NotStarted,
    series: [],
    request: {
      requestId: '1',
      dashboardId: 1,
      intervalMs: 1000,
      interval: '1s',
      panelId: 1,
      range: {
        from: toUtc('2020-01-01', 'YYYY-MM-DD'),
        to: toUtc('2020-01-02', 'YYYY-MM-DD'),
        raw: {
          from: toUtc('2020-01-01', 'YYYY-MM-DD'),
          to: toUtc('2020-01-02', 'YYYY-MM-DD'),
        },
      },
      scopedVars: {},
      targets: [],
      timezone: 'GMT',
      app: 'Grafana',
      startTime: 0,
    },
    timeRange: {
      from: toUtc('2020-01-01', 'YYYY-MM-DD'),
      to: toUtc('2020-01-02', 'YYYY-MM-DD'),
      raw: {
        from: toUtc('2020-01-01', 'YYYY-MM-DD'),
        to: toUtc('2020-01-02', 'YYYY-MM-DD'),
      },
    },
  };
  const history: any[] = [];
  const exploreMode = 'Metrics';

  const props: any = {
    query,
    data,
    range,
    datasource,
    exploreMode,
    history,
    onChange,
    onRunQuery,
  };

  Object.assign(props, propOverrides);

  return <PromExploreQueryEditor {...props} />;
};

describe('PromExploreQueryEditor', () => {
  it('should render component', () => {
    render(setup());
    expect(screen.getByTestId(testIds.editor)).toBeInTheDocument();
  });

  it('should render PromQueryField with ExtraFieldElement', async () => {
    render(setup());
    expect(screen.getByTestId(extraFieldTestIds.extraFieldEditor)).toBeInTheDocument();
  });

  it('should set default value for expr if it is undefined', async () => {
    const onChange = jest.fn();
    const query = { expr: undefined, exemplar: false, instant: false, range: true };
    render(setup({ onChange, query }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ expr: '' }));
  });

  it('should set default value for exemplars if it is undefined', async () => {
    const onChange = jest.fn();
    const query = { expr: '', instant: false, range: true };
    render(setup({ onChange, query }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ exemplar: true }));
  });

  it('should set default value for instant and range if expr is falsy', async () => {
    const onChange = jest.fn();
    let query = { expr: '', exemplar: true };
    render(setup({ onChange, query }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ instant: true, range: true }));
  });

  it('should not set default value for instant and range with truthy expr', async () => {
    const onChange = jest.fn();
    let query = { expr: 'foo', exemplar: true };
    render(setup({ onChange, query }));
    expect(onChange).toHaveBeenCalledTimes(0);
  });

  it('should add default values for multiple missing values', async () => {
    const onChange = jest.fn();
    let query = {};
    render(setup({ onChange, query }));
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});
