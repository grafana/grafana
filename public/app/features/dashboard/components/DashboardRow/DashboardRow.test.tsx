import { screen, render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

import { PanelModel } from '../../state/PanelModel';

import { DashboardRow } from './DashboardRow';

describe('DashboardRow', () => {
  let panel: PanelModel, dashboardMock: any;

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
    render(<DashboardRow panel={panel} dashboard={dashboardMock} />);
  });

  it('Should not have collapsed class when collaped is false', () => {
    const row = screen.getByTestId('dashboard-row-container');
    expect(row).toBeInTheDocument();
    expect(row).not.toHaveClass('dashboard-row--collapsed');
  });

  it('Should collapse after clicking title', () => {
    fireEvent.click(screen.getByTestId('data-testid dashboard-row-title-'));
    //screen.find('.dashboard-row__title').simulate('click');

    const row = screen.getByTestId('dashboard-row-container');
    expect(row).toHaveClass('dashboard-row--collapsed');
    expect(dashboardMock.toggleRow.mock.calls).toHaveLength(1);
  });

  it('Should subscribe to event during mount', () => {
    expect(dashboardMock.events.subscribe.mock.calls).toHaveLength(1);
  });

  it('should have two actions as admin', () => {
    expect(screen.getByTestId('dashboard-row-actions').children).toHaveLength(2);
  });

  it('should not show row drag handle when cannot edit', () => {
    cleanup();
    dashboardMock.meta.canEdit = false;
    render(<DashboardRow panel={panel} dashboard={dashboardMock} />);
    expect(screen.queryByTestId('dashboard-row-drag')).not.toBeInTheDocument();
  });

  it('should have zero actions when cannot edit', () => {
    cleanup();
    dashboardMock.meta.canEdit = false;
    panel = new PanelModel({ collapsed: false });
    render(<DashboardRow panel={panel} dashboard={dashboardMock} />);
    expect(screen.queryByTestId('dashboard-row-actions')).not.toBeInTheDocument();
  });
});
