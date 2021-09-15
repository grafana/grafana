import React from 'react';
import { render, screen } from '@testing-library/react';
import { AddPanelWidgetUnconnected as AddPanelWidget, Props } from './AddPanelWidget';
import { DashboardModel, PanelModel } from '../../state';

const getTestContext = (propOverrides?: object) => {
  const props: Props = {
    dashboard: {} as DashboardModel,
    panel: {} as PanelModel,
    addPanel: jest.fn() as any,
  };
  Object.assign(props, propOverrides);
  return render(<AddPanelWidget {...props} />);
};

describe('AddPanelWidget', () => {
  it('should render component without error', () => {
    expect(() => {
      getTestContext();
    });
  });

  it('should render the add panel actions', () => {
    getTestContext();
    expect(screen.getByText(/Add an empty panel/i)).toBeInTheDocument();
    expect(screen.getByText(/Add a new row/i)).toBeInTheDocument();
    expect(screen.getByText(/Add a panel from the panel library/i)).toBeInTheDocument();
  });
});
