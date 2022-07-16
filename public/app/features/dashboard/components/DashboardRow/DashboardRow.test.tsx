import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  });

  it('Should not have collapsed class when collaped is false', () => {
    render(<DashboardRow panel={panel} dashboard={dashboardMock} />);
    const row = screen.getByTestId('dashboard-row-container');
    expect(row).toBeInTheDocument();
    expect(row).not.toHaveClass('dashboard-row--collapsed');
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
    render(<DashboardRow panel={panel} dashboard={dashboardMock} />);
    expect(dashboardMock.events.subscribe.mock.calls).toHaveLength(1);
  });

  it('should have a row options and delete row button', () => {
    render(<DashboardRow panel={panel} dashboard={dashboardMock} />);
    expect(screen.getByRole('button', { name: 'Delete row' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Row options' })).toBeInTheDocument();
  });

  it('should not show row drag handle when cannot edit', () => {
    dashboardMock.meta.canEdit = false;
    render(<DashboardRow panel={panel} dashboard={dashboardMock} />);
    expect(screen.queryByTestId('dashboard-row-container')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-row-drag')).not.toBeInTheDocument();
  });

  it('should have zero actions when cannot edit', () => {
    dashboardMock.meta.canEdit = false;
    panel = new PanelModel({ collapsed: false });
    render(<DashboardRow panel={panel} dashboard={dashboardMock} />);
    expect(screen.queryByRole('button', { name: 'Delete row' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Row options' })).not.toBeInTheDocument();
  });
});
