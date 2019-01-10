import React from 'react';
import { shallow } from 'enzyme';
import { DashboardModel } from '../dashboard/dashboard_model';
import { Props, TestRuleButton } from './TestRuleButton';

jest.mock('app/core/services/backend_srv', () => ({
  getBackendSrv: () => ({
    post: jest.fn(),
  }),
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    panelId: 1,
    dashboard: new DashboardModel({ panels: [{ id: 1 }] }),
    LoadingPlaceholder: {},
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<TestRuleButton {...props} />);

  return { wrapper, instance: wrapper.instance() as TestRuleButton };
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
