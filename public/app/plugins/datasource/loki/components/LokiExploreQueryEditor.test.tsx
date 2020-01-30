import React from 'react';
import { shallow, render } from 'enzyme';
import LokiExploreQueryEditor from './LokiExploreQueryEditor';
import { LokiDatasource } from '../datasource';
import { LokiQuery } from '../types';
import { ExploreMode, PanelData, LoadingState, dateTime } from '@grafana/data';

const setup = (renderMethod: any, propOverrides?: object) => {
  const datasourceMock: unknown = {};
  const datasource: LokiDatasource = datasourceMock as LokiDatasource;
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
        from: dateTime('2020-01-01', 'YYYY-MM-DD'),
        to: dateTime('2020-01-02', 'YYYY-MM-DD'),
        raw: {
          from: dateTime('2020-01-01', 'YYYY-MM-DD'),
          to: dateTime('2020-01-02', 'YYYY-MM-DD'),
        },
      },
      scopedVars: {},
      targets: [],
      timezone: 'GMT',
      app: 'Grafana',
      startTime: 0,
    },
    timeRange: {
      from: dateTime('2020-01-01', 'YYYY-MM-DD'),
      to: dateTime('2020-01-02', 'YYYY-MM-DD'),
      raw: {
        from: dateTime('2020-01-01', 'YYYY-MM-DD'),
        to: dateTime('2020-01-02', 'YYYY-MM-DD'),
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
  it('should render component', () => {
    const wrapper = setup(shallow);
    expect(wrapper).toMatchSnapshot();
  });

  it('should render LokiQueryField with ExtraFieldElement when ExploreMode is set to Logs', () => {
    const wrapper = setup(render);
    expect(wrapper.find('.explore-input--ml')).toHaveLength(1);
  });

  it('should render LokiQueryField with no ExtraFieldElement when ExploreMode is not Logs', () => {
    const wrapper = setup(render, { exploreMode: ExploreMode.Metrics });
    expect(wrapper.find('.explore-input--ml')).toHaveLength(0);
  });
});
