import { render, screen } from '@testing-library/react';
import React, { act } from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { Sidebar, useSidebar } from './Sidebar';

function mockMatchMedia(shouldMatchMobile: boolean) {
  const original = window.matchMedia;
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: shouldMatchMobile && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
  return () => {
    window.matchMedia = original;
  };
}

describe('Sidebar', () => {
  it('should render sidebar', async () => {
    render(<TestSetup />);

    act(() => screen.getByLabelText('Settings').click());

    // Verify pane is open
    expect(screen.getByTestId(selectors.components.Sidebar.headerTitle)).toBeInTheDocument();

    act(() => screen.getByLabelText('Dock').click());

    // Verify wrapper pushes content when docked
    const wrapper = screen.getByTestId('sidebar-test-wrapper');
    expect(wrapper).toHaveStyle('padding-right: 312px');

    // Close pane
    act(() => screen.getByLabelText('Close').click());
    // Verify pane is closed
    expect(screen.queryByTestId(selectors.components.Sidebar.headerTitle)).not.toBeInTheDocument();
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

  describe('hidden state', () => {
    it('renders show button instead of the sidebar container when defaultIsHidden is true', () => {
      render(<TestSetup defaultIsHidden />);

      expect(screen.getByTestId(selectors.components.Sidebar.showHideToggle)).toBeInTheDocument();
      expect(screen.queryByTestId(selectors.components.Sidebar.container)).not.toBeInTheDocument();
    });

    it('shows sidebar after clicking the show button', () => {
      render(<TestSetup defaultIsHidden />);

      act(() => screen.getByTestId(selectors.components.Sidebar.showHideToggle).click());

      expect(screen.getByTestId(selectors.components.Sidebar.container)).toBeInTheDocument();
      expect(screen.queryByTestId(selectors.components.Sidebar.showHideToggle)).not.toBeInTheDocument();
    });

    it('does not reserve space on the outer wrapper when hidden', () => {
      render(<TestSetup defaultIsHidden />);

      const wrapper = screen.getByTestId('sidebar-test-wrapper');
      expect(wrapper).not.toHaveStyle('padding-right: 64px');
    });

    it('persists the un-hidden state across remounts', () => {
      const { unmount } = render(<TestSetup defaultIsHidden persistanceKey="hidden-persist" />);

      act(() => screen.getByTestId(selectors.components.Sidebar.showHideToggle).click());
      expect(screen.getByTestId(selectors.components.Sidebar.container)).toBeInTheDocument();

      unmount();

      render(<TestSetup defaultIsHidden persistanceKey="hidden-persist" />);
      expect(screen.getByTestId(selectors.components.Sidebar.container)).toBeInTheDocument();
    });
  });

  describe('mobile viewport', () => {
    let restore: () => void;

    beforeEach(() => {
      restore = mockMatchMedia(true);
    });

    afterEach(() => {
      restore();
    });

    it('does not render the dock toggle in the toolbar', () => {
      render(<TestSetup />);

      expect(screen.queryByTestId(selectors.components.Sidebar.dockToggle)).not.toBeInTheDocument();
    });

    it('forces docked layout without user interaction', () => {
      render(<TestSetup />);

      act(() => screen.getByLabelText('Settings').click());

      const wrapper = screen.getByTestId('sidebar-test-wrapper');
      expect(wrapper).toHaveStyle('padding-right: 312px');
    });
  });
});

interface TestSetupProps {
  persistanceKey?: string;
  defaultIsHidden?: boolean;
}

function TestSetup({ persistanceKey, defaultIsHidden }: TestSetupProps) {
  const [openPane, setOpenPane] = React.useState('');
  const contextValue = useSidebar({
    position: 'right',
    hasOpenPane: openPane !== '',
    persistanceKey,
    onClosePane: () => setOpenPane(''),
    defaultIsHidden,
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
