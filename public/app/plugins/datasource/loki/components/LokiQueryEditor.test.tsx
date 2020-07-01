import React from 'react';
import { shallow } from 'enzyme';
import { toUtc } from '@grafana/data';

import { LokiQueryEditor } from './LokiQueryEditor';
import { LokiDatasource } from '../datasource';
import { LokiQuery } from '../types';

const createMockRequestRange = (from: string, to: string) => {
  return {
    request: {
      range: {
        from: toUtc(from, 'YYYY-MM-DD'),
        to: toUtc(to, 'YYYY-MM-DD'),
      },
    },
  };
};

const setup = (propOverrides?: object) => {
  const datasourceMock: unknown = {};
  const datasource: LokiDatasource = datasourceMock as LokiDatasource;
  const onRunQuery = jest.fn();
  const onChange = jest.fn();

  const query: LokiQuery = {
    expr: '',
    refId: 'A',
    legendFormat: 'My Legend',
  };

  const data = createMockRequestRange('2020-01-01', '2020-01-02');

  const props: any = {
    datasource,
    onChange,
    onRunQuery,
    query,
    data,
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<LokiQueryEditor {...props} />);
  const instance = wrapper.instance() as LokiQueryEditor;

  return {
    instance,
    wrapper,
  };
};

describe('Render LokiQueryEditor with legend', () => {
  it('should render', () => {
    const { wrapper } = setup();
    expect(wrapper).toMatchSnapshot();
  });

  it('should update absolute timerange', () => {
    const { wrapper } = setup();
    wrapper.setProps({
      data: createMockRequestRange('2019-01-01', '2020-01-02'),
    });
    expect(wrapper).toMatchSnapshot();
  });
});
