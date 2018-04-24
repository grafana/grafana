import React from 'react';
import { shallow } from 'enzyme';
import { DashboardRow } from '../dashgrid/DashboardRow';
import { PanelModel } from '../panel_model';

describe('DashboardRow', () => {
  let wrapper, panel, getPanelContainer, dashboardMock;

  beforeEach(() => {
    dashboardMock = {
      toggleRow: jest.fn(),
      meta: {
        canEdit: true,
      },
    };

    getPanelContainer = jest.fn().mockReturnValue({
      getDashboard: jest.fn().mockReturnValue(dashboardMock),
      getPanelLoader: jest.fn(),
    });

    panel = new PanelModel({ collapsed: false });
    wrapper = shallow(<DashboardRow panel={panel} getPanelContainer={getPanelContainer} />);
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

  it('should have two actions as admin', () => {
    expect(wrapper.find('.dashboard-row__actions .pointer')).toHaveLength(2);
  });

  it('should have zero actions when cannot edit', () => {
    dashboardMock.meta.canEdit = false;
    panel = new PanelModel({ collapsed: false });
    wrapper = shallow(<DashboardRow panel={panel} getPanelContainer={getPanelContainer} />);
    expect(wrapper.find('.dashboard-row__actions .pointer')).toHaveLength(0);
  });
});
