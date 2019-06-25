import React from 'react';
import { shallow } from 'enzyme';
import { dateTime } from '@grafana/ui';

import { PromQueryEditor } from './PromQueryEditor';
import { PrometheusDatasource } from '../datasource';
import { PromQuery } from '../types';

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

const setup = (propOverrides?: object) => {
  const datasourceMock: unknown = {
    createQuery: jest.fn(q => q),
    getPrometheusTime: jest.fn((date, roundup) => 123),
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

  const wrapper = shallow(<PromQueryEditor {...props} />);
  const instance = wrapper.instance() as PromQueryEditor;

  return {
    instance,
    wrapper,
  };
};

describe('Render PromQueryEditor with basic options', () => {
  it('should render', () => {
    const { wrapper } = setup();
    expect(wrapper).toMatchSnapshot();
  });
});
