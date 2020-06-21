import React from 'react';
import { QueryRow, QueryRowProps } from './QueryRow';
import { shallow } from 'enzyme';
import { ExploreId } from 'app/types/explore';
import { Emitter } from 'app/core/utils/emitter';
import { DataSourceApi, TimeRange, AbsoluteTimeRange, ExploreMode, PanelData } from '@grafana/data';

const setup = (propOverrides?: object) => {
  const props: QueryRowProps = {
    exploreId: ExploreId.left,
    index: 1,
    exploreEvents: {} as Emitter,
    changeQuery: jest.fn(),
    datasourceInstance: {} as DataSourceApi,
    highlightLogsExpressionAction: jest.fn() as any,
    history: [],
    query: {
      refId: 'A',
    },
    modifyQueries: jest.fn(),
    range: {} as TimeRange,
    absoluteRange: {} as AbsoluteTimeRange,
    removeQueryRowAction: jest.fn() as any,
    runQueries: jest.fn(),
    queryResponse: {} as PanelData,
    latency: 1,
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<QueryRow {...props} />);
  return wrapper;
};

const ExploreMetricsQueryField = () => <div />;
const ExploreLogsQueryField = () => <div />;
const ExploreQueryField = () => <div />;
const QueryEditor = () => <div />;

describe('QueryRow', () => {
  describe('if datasource has all query field components ', () => {
    const allComponents = {
      ExploreMetricsQueryField,
      ExploreLogsQueryField,
      ExploreQueryField,
      QueryEditor,
    };

    it('it should render ExploreMetricsQueryField in metrics mode', () => {
      const wrapper = setup({ mode: ExploreMode.Metrics, datasourceInstance: { components: allComponents } });
      expect(wrapper.find(ExploreMetricsQueryField)).toHaveLength(1);
    });
    it('it should render ExploreLogsQueryField in logs mode', () => {
      const wrapper = setup({ mode: ExploreMode.Logs, datasourceInstance: { components: allComponents } });
      expect(wrapper.find(ExploreLogsQueryField)).toHaveLength(1);
    });
    it('it should render ExploreQueryField in tracing mode', () => {
      const wrapper = setup({ mode: ExploreMode.Tracing, datasourceInstance: { components: allComponents } });
      expect(wrapper.find(ExploreQueryField)).toHaveLength(1);
    });
  });

  describe('if datasource does not have Explore query fields ', () => {
    it('it should render QueryEditor if datasource has it', () => {
      const wrapper = setup({ datasourceInstance: { components: { QueryEditor } } });
      expect(wrapper.find(QueryEditor)).toHaveLength(1);
    });
    it('it should not render QueryEditor if datasource does not have it', () => {
      const wrapper = setup({ datasourceInstance: { components: {} } });
      expect(wrapper.find(QueryEditor)).toHaveLength(0);
    });
  });
});
