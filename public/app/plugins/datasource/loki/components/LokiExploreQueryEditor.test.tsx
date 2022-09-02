import { render, screen } from '@testing-library/react';
import React from 'react';

import { LoadingState, PanelData, toUtc, TimeRange, HistoryItem } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

import { LokiDatasource } from '../datasource';
import LokiLanguageProvider from '../language_provider';
import { createLokiDatasource } from '../mocks';
import { LokiQuery } from '../types';

import { LokiExploreQueryEditor, Props } from './LokiExploreQueryEditor';

const setup = () => {
  const mockTemplateSrv: TemplateSrv = {
    getVariables: jest.fn(),
    replace: jest.fn(),
    containsTemplate: jest.fn(),
    updateTimeRange: jest.fn(),
  };
  const datasource: LokiDatasource = createLokiDatasource(mockTemplateSrv);
  datasource.languageProvider = new LokiLanguageProvider(datasource);
  jest.spyOn(datasource, 'metadataRequest').mockResolvedValue([]);

  const onRunQuery = jest.fn();
  const onChange = jest.fn();
  const query: LokiQuery = { expr: '', refId: 'A', maxLines: 0 };
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
      interval: '1s',
      intervalMs: 1000,
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
  const history: Array<HistoryItem<LokiQuery>> = [];

  const props: Props = {
    query,
    data,
    range,
    datasource,
    history,
    onChange,
    onRunQuery,
  };

  render(<LokiExploreQueryEditor {...props} />);
};

describe('LokiExploreQueryEditor', () => {
  let originalGetSelection: typeof window.getSelection;
  beforeAll(() => {
    originalGetSelection = window.getSelection;
    window.getSelection = () => null;
  });

  afterAll(() => {
    window.getSelection = originalGetSelection;
  });

  it('should render component without throwing an error', () => {
    expect(() => setup()).not.toThrow();
  });

  it('should render LokiQueryField with ExtraFieldElement when ExploreMode is set to Logs', async () => {
    setup();
    expect(screen.getByLabelText('Loki extra field')).toBeInTheDocument();
  });
});
