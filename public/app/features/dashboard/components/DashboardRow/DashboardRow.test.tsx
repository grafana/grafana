import React from 'react';
import { mount } from 'enzyme';
import { DashboardRow } from './DashboardRow';
import { PanelModel } from '../../state/PanelModel';

describe('DashboardRow', () => {
  let wrapper: any, panel: PanelModel, dashboardMock: any;

  beforeEach(() => {
    dashboardMock = {
      toggleRow: jest.fn(),
      on: jest.fn(),
      meta: {
        canEdit: true,
      },
    };

    panel = new PanelModel({ collapsed: false });
    wrapper = mount(<DashboardRow panel={panel} dashboard={dashboardMock} />);
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

  it('should not show row drag handle when cannot edit', () => {
    dashboardMock.meta.canEdit = false;
    wrapper = mount(<DashboardRow panel={panel} dashboard={dashboardMock} />);
    expect(wrapper.find('.dashboard-row__drag')).toHaveLength(0);
  });

  it('should have zero actions when cannot edit', () => {
    dashboardMock.meta.canEdit = false;
    panel = new PanelModel({ collapsed: false });
    wrapper = mount(<DashboardRow panel={panel} dashboard={dashboardMock} />);
    expect(wrapper.find('.dashboard-row__actions .pointer')).toHaveLength(0);
  });
});
