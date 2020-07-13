import React from 'react';
import { QueryRow, QueryRowProps } from './QueryRow';
import { shallow } from 'enzyme';
import { ExploreId } from 'app/types/explore';
import { Emitter } from 'app/core/utils/emitter';
import { DataSourceApi, TimeRange, AbsoluteTimeRange, PanelData } from '@grafana/data';

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

const QueryEditor = () => <div />;

describe('QueryRow', () => {
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
