import { render, screen } from '@testing-library/react';
import React from 'react';

import { PanelModel } from '../../state';
import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';

import { AddPanelWidgetUnconnected as AddPanelWidget, Props } from './AddPanelWidget';

const getTestContext = (propOverrides?: object) => {
  const props: Props = {
    dashboard: createDashboardModelFixture(),
    panel: new PanelModel({}),
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
    expect(screen.getByText(/Add a new panel/i)).toBeInTheDocument();
    expect(screen.getByText(/Add a new row/i)).toBeInTheDocument();
    expect(screen.getByText(/Add a panel from the panel library/i)).toBeInTheDocument();
  });
});
