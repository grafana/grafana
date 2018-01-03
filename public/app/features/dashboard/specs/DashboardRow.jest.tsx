import React from 'react';
import { shallow } from 'enzyme';
import { DashboardRow } from '../dashgrid/DashboardRow';
import { PanelModel } from '../panel_model';

describe('DashboardRow', () => {
  let wrapper, panel, dashboardMock;

  beforeEach(() => {
    dashboardMock = { toggleRow: jest.fn() };

    panel = new PanelModel({ collapsed: false });
    wrapper = shallow(<DashboardRow panel={panel} dashboard={dashboardMock} />);
  });

  it('Should not have collapsed class when collaped is false', () => {
    expect(wrapper.find('.dashboard-row')).toHaveLength(1);
    expect(wrapper.find('.dashboard-row--collapsed')).toHaveLength(0);
  });

  it('Should collapse after clicking title', () => {
    wrapper.find('.dashboard-row__title').simulate('click');

    expect(wrapper.find('.dashboard-row--collapsed')).toHaveLength(1);
    expect(dashboardMock.toggleRow.mock.calls).toHaveLength(1);
  });
});
