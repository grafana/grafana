import { render, screen } from '@testing-library/react';
import React, { act } from 'react';

import { Sidebar, useSidebar } from './Sidebar';

describe('Sidebar', () => {
  it('should render sidebar', async () => {
    render(<TestSetup />);

    act(() => screen.getByLabelText('Settings').click());

    // Verify pane is open
    expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();

    act(() => screen.getByLabelText('Dock').click());

    // Verify wrapper pushes content when docked
    const wrapper = screen.getByTestId('sidebar-test-wrapper');
    expect(wrapper).toHaveStyle('padding-right: 352px');

    // Close pane
    act(() => screen.getByLabelText('Close').click());
    // Verify pane is closed
    expect(screen.queryByTestId('sidebar-pane-header-title')).not.toBeInTheDocument();
  });

  it('Can persist docked state', async () => {
    const { unmount } = render(<TestSetup persistanceKey="test" />);

    act(() => screen.getByLabelText('Settings').click());
    act(() => screen.getByLabelText('Dock').click());

    unmount();

    render(<TestSetup persistanceKey="test" />);

    act(() => screen.getByLabelText('Settings').click());
    expect(screen.getByLabelText('Undock')).toBeInTheDocument();
  });
});

interface TestSetupProps {
  persistanceKey?: string;
}

function TestSetup({ persistanceKey }: TestSetupProps) {
  const [openPane, setOpenPane] = React.useState('');
  const contextValue = useSidebar({
    position: 'right',
    hasOpenPane: openPane !== '',
    persistanceKey,
    onClosePane: () => setOpenPane(''),
  });

  return (
    <div {...contextValue.outerWrapperProps} data-testid="sidebar-test-wrapper">
      <Sidebar contextValue={contextValue}>
        {openPane === 'settings' && (
          <Sidebar.OpenPane>
            <Sidebar.PaneHeader title="Settings" />
          </Sidebar.OpenPane>
        )}
        <Sidebar.Toolbar>
          <Sidebar.Button icon="cog" title="Settings" onClick={() => setOpenPane('settings')} />
          <Sidebar.Button icon="process" title="Data" tooltip="Data transformations" />
          <Sidebar.Button icon="bell" title="Alerts" />
        </Sidebar.Toolbar>
      </Sidebar>
    </div>
  );
}
