import React from 'react';
import { render } from '@testing-library/react';
import { DashNavTimeControls } from './DashNavTimeControls';
import { DashboardModel } from '../../state/DashboardModel';
import { getDashboardModel } from '../../../../../test/helpers/getDashboardModel';

describe('DashNavTimeControls', () => {
  let dashboardModel: DashboardModel;

  beforeEach(() => {
    const json = {
      panels: [
        {
          datasource: null,
          gridPos: {
            h: 3,
            w: 24,
            x: 0,
            y: 8,
          },
          id: 1,
          type: 'welcome',
        },
      ],
      refresh: '',
      templating: {
        list: [],
      },
    };
    dashboardModel = getDashboardModel(json);
  });

  it('renders RefreshPicker in panel view', () => {
    const container = render(
      <DashNavTimeControls dashboard={dashboardModel} onChangeTimeZone={jest.fn()} key="time-controls" />
    );
    expect(container.queryByLabelText(/RefreshPicker run button/i)).toBeInTheDocument();
  });

  it('should not render RefreshPicker in panel edit', () => {
    const panel: any = { destroy: jest.fn(), isEditing: true };
    dashboardModel.startRefresh = jest.fn();
    dashboardModel.panelInEdit = panel;
    const container = render(
      <DashNavTimeControls dashboard={dashboardModel} onChangeTimeZone={jest.fn()} key="time-controls" />
    );
    expect(container.queryByLabelText(/RefreshPicker run button/i)).not.toBeInTheDocument();
  });
});
