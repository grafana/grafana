import React from 'react';
import { mount, shallow } from 'enzyme';
import { act } from 'react-dom/test-utils';
import LokiExploreQueryEditor from './LokiExploreQueryEditor';
import { LokiExploreExtraField } from './LokiExploreExtraField';
import { LokiDatasource } from '../datasource';
import { LokiQuery } from '../types';
import { ExploreMode, LoadingState, PanelData, toUtc } from '@grafana/data';
import { makeMockLokiDatasource } from '../mocks';
import LokiLanguageProvider from '../language_provider';

const setup = (renderMethod: any, propOverrides?: object) => {
  const datasource: LokiDatasource = makeMockLokiDatasource({});
  datasource.languageProvider = new LokiLanguageProvider(datasource);
  const onRunQuery = jest.fn();
  const onChange = jest.fn();
  const query: LokiQuery = { expr: '', refId: 'A', maxLines: 0 };
  const data: PanelData = {
    state: LoadingState.NotStarted,
    series: [],
    request: {
      requestId: '1',
      dashboardId: 1,
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
  const exploreMode: ExploreMode = ExploreMode.Logs;

  const props: any = {
    query,
    data,
    datasource,
    exploreMode,
    history,
    onChange,
    onRunQuery,
  };

  Object.assign(props, { ...props, ...propOverrides });
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
      expect(wrapper.find(LokiExploreExtraField).length).toBe(1);
    });
  });
});
