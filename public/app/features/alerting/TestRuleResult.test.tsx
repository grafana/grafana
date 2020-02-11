import React from 'react';
import { TestRuleResult, Props } from './TestRuleResult';
import { DashboardModel } from '../dashboard/state';
import { shallow } from 'enzyme';

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');

  return {
    ...original,
    getBackendSrv: () => ({
      post: jest.fn(),
    }),
  };
});

const setup = (propOverrides?: object) => {
  const props: Props = {
    panelId: 1,
    dashboard: new DashboardModel({ panels: [{ id: 1 }] }),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<TestRuleResult {...props} />);

  return { wrapper, instance: wrapper.instance() as TestRuleResult };
};

describe('Render', () => {
  it('should render component', () => {
    const { wrapper } = setup();

    expect(wrapper).toMatchSnapshot();
  });
});

describe('Life cycle', () => {
  describe('component did mount', () => {
    it('should call testRule', () => {
      const { instance } = setup();
      instance.testRule = jest.fn();
      instance.componentDidMount();

      expect(instance.testRule).toHaveBeenCalled();
    });
  });
});
