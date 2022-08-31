import { mount, shallow } from 'enzyme';
import React from 'react';
import { act } from 'react-dom/test-utils';

import { LoadingState, PanelData, toUtc, TimeRange, HistoryItem } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

import { LokiDatasource } from '../datasource';
import LokiLanguageProvider from '../language_provider';
import { createLokiDatasource } from '../mocks';
import { LokiQuery } from '../types';

import { LokiExploreQueryEditor, Props } from './LokiExploreQueryEditor';
import { LokiOptionFields } from './LokiOptionFields';

const setup = (renderMethod: (c: JSX.Element) => ReturnType<typeof shallow> | ReturnType<typeof mount>) => {
  const datasource: LokiDatasource = createLokiDatasource({} as unknown as TemplateSrv);
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

  return renderMethod(<LokiExploreQueryEditor {...props} />);
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

  it('should render component', () => {
    const wrapper = setup(shallow);
    expect(wrapper).toMatchSnapshot();
  });

  it('should render LokiQueryField with ExtraFieldElement when ExploreMode is set to Logs', async () => {
    // @ts-ignore strict null error TS2345: Argument of type '() => Promise<void>' is not assignable to parameter of type '() => void | undefined'.
    await act(async () => {
      const wrapper = setup(mount);
      expect(wrapper.find(LokiOptionFields).length).toBe(1);
    });
  });
});
