import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mount } from 'enzyme';
import React from 'react';

import { PanelModel } from '../../state/PanelModel';

import { DashboardRow } from './DashboardRow';

describe('DashboardRow', () => {
  let wrapper: any, panel: PanelModel, dashboardMock: any;

  beforeEach(() => {
    dashboardMock = {
      toggleRow: jest.fn(),
      on: jest.fn(),
      meta: {
        canEdit: true,
      },
      events: { subscribe: jest.fn() },
    };

    panel = new PanelModel({ collapsed: false });
    wrapper = mount(<DashboardRow panel={panel} dashboard={dashboardMock} />);
  });

  it('Should not have collapsed class when collaped is false', () => {
    expect(wrapper.find('.dashboard-row')).toHaveLength(1);
    expect(wrapper.find('.dashboard-row--collapsed')).toHaveLength(0);
  });

  it('Should collapse when the panel is collapsed', async () => {
    const panel = new PanelModel({ collapsed: true });
    render(<DashboardRow panel={panel} dashboard={dashboardMock} />);
    const row = screen.getByTestId('dashboard-row-container');
    expect(row).toHaveClass('dashboard-row--collapsed');
  });

  it('Should collapse after clicking title', async () => {
    render(<DashboardRow panel={panel} dashboard={dashboardMock} />);
    await userEvent.click(screen.getByTestId('data-testid dashboard-row-title-'));
    expect(dashboardMock.toggleRow.mock.calls).toHaveLength(1);
  });

  it('Should subscribe to event during mount', () => {
    expect(dashboardMock.events.subscribe.mock.calls).toHaveLength(1);
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
