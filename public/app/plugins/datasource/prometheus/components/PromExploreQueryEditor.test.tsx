import React from 'react';
import { shallow } from 'enzyme';
import { act } from 'react-dom/test-utils';
import PromExploreQueryEditor from './PromExploreQueryEditor';
import { PrometheusDatasource } from '../datasource';
import { PromQuery } from '../types';
import { LoadingState, PanelData, toUtc } from '@grafana/data';

const setup = (renderMethod: any, propOverrides?: object) => {
  const datasourceMock: unknown = {};
  const datasource: PrometheusDatasource = datasourceMock as PrometheusDatasource;
  const onRunQuery = jest.fn();
  const onChange = jest.fn();
  const query: PromQuery = { expr: '', refId: 'A', interval: '1s' };
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
  const exploreMode = 'Metrics';

  const props: any = {
    query,
    data,
    datasource,
    exploreMode,
    history,
    onChange,
    onRunQuery,
  };

  Object.assign(props, propOverrides);

  return renderMethod(<PromExploreQueryEditor {...props} />);
};

describe('PromExploreQueryEditor', () => {
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

  it('should render PromQueryField with ExtraFieldElement', async () => {
    // @ts-ignore strict null errpr TS2345: Argument of type '() => Promise<void>' is not assignable to parameter of type '() => void | undefined'.
    await act(async () => {
      const wrapper = setup(shallow);
      expect(wrapper.html()).toContain('aria-label="Prometheus extra field"');
    });
  });
});
