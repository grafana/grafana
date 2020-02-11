import React from 'react';
import { shallow } from 'enzyme';
import { AddPanelWidgetUnconnected as AddPanelWidget, Props } from './AddPanelWidget';
import { DashboardModel, PanelModel } from '../../state';

const setup = (propOverrides?: object) => {
  const props: Props = {
    dashboard: {} as DashboardModel,
    panel: {} as PanelModel,
    addPanelToDashboard: jest.fn() as any,
  };

  Object.assign(props, propOverrides);

  return shallow(<AddPanelWidget {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
