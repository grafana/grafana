import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('floats without reserving panel space and stays open when interacting with the dashboard', async () => {
    render(<TestSetup enableFloating />);
    act(() => screen.getByLabelText('Settings').click());
    act(() => screen.getByLabelText('Dock').click());
    act(() => screen.getByLabelText('Float toolbox').click());

    expect(screen.getByTestId('sidebar-test-wrapper')).toHaveStyle('padding-top: 0px; padding-right: 72px');
    expect(screen.getByTestId('sidebar-test-wrapper')).not.toHaveStyle('padding-right: 312px');
    await userEvent.click(document.body);
    expect(screen.getByTestId(selectors.components.Sidebar.headerTitle)).toHaveTextContent('Settings');

    act(() => screen.getByLabelText('Return to sidebar').click());
    expect(screen.getByTestId('sidebar-test-wrapper')).toHaveStyle('padding-right: 312px');
  });

  it('minimizes, moves, parks above panels, and restores the expanded size', async () => {
    render(<TestSetup enableFloating />);
    act(() => screen.getByLabelText('Settings').click());
    act(() => screen.getByLabelText('Float toolbox').click());
    const toolbox = screen.getByRole('region', { name: 'Floating sidebar' });
    screen.getByLabelText('Resize toolbox').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(toolbox).toHaveStyle('width: 450px');
    act(() => screen.getByLabelText('Minimize toolbox').click());
    expect(toolbox).toHaveStyle('height: 48px');
    screen.getByLabelText('Move toolbox').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(toolbox).toHaveStyle('left: 522px');
    act(() => screen.getByLabelText('Move away from panels').click());
    expect(toolbox).toHaveStyle('top: 0px; left: 0px; height: 48px');
    expect(screen.getByTestId('sidebar-test-wrapper')).toHaveStyle('padding-top: 0px');
    act(() => screen.getByLabelText('Expand toolbox').click());
    expect(toolbox).toHaveStyle('width: 450px; height: 560px');
    expect(screen.getByTestId('sidebar-test-wrapper')).toHaveStyle('padding-top: 0px');
  });

  it('keeps the floating toolbox inside the available area when moved or resized', async () => {
    render(<TestSetup enableFloating />);
    act(() => screen.getByLabelText('Settings').click());
    act(() => screen.getByLabelText('Float toolbox').click());
    screen.getByLabelText('Move toolbox').focus();
    await userEvent.keyboard('{Shift>}{ArrowLeft>20/}{/Shift}');
    screen.getByLabelText('Move toolbox').focus();
    await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}');
    expect(screen.getByRole('region', { name: 'Floating sidebar' })).toHaveStyle('left: 0px; top: 0px');
    for (let i = 0; i < 30; i++) {
      screen.getByLabelText('Resize toolbox').focus();
      await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
      screen.getByLabelText('Resize toolbox').focus();
      await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}');
    }
    expect(screen.getByRole('region', { name: 'Floating sidebar' })).toHaveStyle('width: 320px; height: 48px');
    expect(screen.getByLabelText('Expand toolbox')).toBeInTheDocument();
  });

  it('drags and resizes the floating toolbox with pointer input', async () => {
    render(<TestSetup enableFloating />);
    act(() => screen.getByLabelText('Settings').click());
    act(() => screen.getByLabelText('Float toolbox').click());
    const handle = screen.getByLabelText('Move toolbox');
    handle.setPointerCapture = jest.fn();
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: handle, coords: { clientX: 20, clientY: 20 } },
      { target: handle, coords: { clientX: 70, clientY: 50 } },
      { keys: '[/MouseLeft]', target: handle },
    ]);
    expect(screen.getByRole('region', { name: 'Floating sidebar' })).toHaveStyle('left: 562px; top: 46px');
    const title = screen.getByRole('button', { name: 'Move Settings toolbox' });
    title.setPointerCapture = jest.fn();
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: title, coords: { clientX: 600, clientY: 60 } },
      { target: title, coords: { clientX: 600, clientY: 0 } },
      { keys: '[/MouseLeft]', target: title },
    ]);
    expect(screen.getByRole('region', { name: 'Floating sidebar' })).toHaveStyle('top: 0px');
    expect(screen.getByTestId(selectors.components.Sidebar.container)).toContainElement(
      screen.getByLabelText('Settings')
    );
    expect(screen.getByRole('region', { name: 'Floating sidebar' })).not.toContainElement(
      screen.getByLabelText('Settings')
    );
    const resize = screen.getByLabelText('Resize toolbox');
    resize.setPointerCapture = jest.fn();
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: resize, coords: { clientX: 440, clientY: 560 } },
      { target: resize, coords: { clientX: 460, clientY: 500 } },
      { keys: '[/MouseLeft]', target: resize },
    ]);
    expect(screen.getByRole('region', { name: 'Floating sidebar' })).toHaveStyle('width: 460px; height: 500px');
  });

  it('keeps quick actions usable while minimized and permits leaving floating mode after closing the pane', async () => {
    render(<TestSetup enableFloating />);
    act(() => screen.getByLabelText('Settings').click());
    act(() => screen.getByLabelText('Float toolbox').click());
    act(() => screen.getByLabelText('Minimize toolbox').click());
    await userEvent.click(screen.getByRole('button', { name: 'Apply setting' }));
    expect(screen.getByTestId(selectors.components.Sidebar.headerTitle)).toHaveTextContent('Updated settings');
    act(() => screen.getByLabelText('Close').click());
    expect(screen.getByRole('region', { name: 'Floating sidebar' })).toHaveTextContent('Nothing is selected');
    expect(screen.getByRole('region', { name: 'Floating sidebar' })).toHaveStyle('width: 320px; height: 48px');
    await userEvent.click(screen.getByLabelText('Settings'));
    act(() => screen.getByLabelText('Return to sidebar').click());
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });

  it('keeps an empty pill movable and restores the pane size when an item is selected', async () => {
    render(<TestSetup enableFloating />);
    act(() => screen.getByLabelText('Settings').click());
    act(() => screen.getByLabelText('Float toolbox').click());
    act(() => screen.getByLabelText('Close').click());
    const pill = screen.getByRole('region', { name: 'Floating sidebar' });
    expect(pill).toHaveTextContent('Nothing is selected');
    expect(pill).toHaveStyle('width: 320px; height: 48px');
    screen.getByRole('button', { name: 'Move Nothing is selected toolbox' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(pill).toHaveStyle('left: 502px');
    await userEvent.click(screen.getByLabelText('Settings'));
    expect(screen.getByRole('region', { name: 'Floating sidebar' })).toHaveStyle(
      'width: 440px; height: 560px; left: 502px'
    );
  });

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
    const { unmount } = render(<TestSetup persistenceKey="test" />);

    act(() => screen.getByLabelText('Settings').click());
    act(() => screen.getByLabelText('Dock').click());

    unmount();

    render(<TestSetup persistenceKey="test" />);

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
      const { unmount } = render(<TestSetup defaultIsHidden persistenceKey="hidden-persist" />);

      act(() => screen.getByTestId(selectors.components.Sidebar.showHideToggle).click());
      expect(screen.getByTestId(selectors.components.Sidebar.container)).toBeInTheDocument();

      unmount();

      render(<TestSetup defaultIsHidden persistenceKey="hidden-persist" />);
      expect(screen.getByTestId(selectors.components.Sidebar.container)).toBeInTheDocument();
    });

    it('renders the sidebar temporarily when hidden and a pane opens', () => {
      render(<TestSetup defaultIsHidden />);

      // Sidebar is hidden — only the show toggle is rendered
      expect(screen.queryByTestId(selectors.components.Sidebar.container)).not.toBeInTheDocument();

      // Open a pane externally (simulating selecting an element while hidden)
      act(() => screen.getByLabelText('Open settings externally').click());

      // Sidebar appears with the pane visible
      expect(screen.getByTestId(selectors.components.Sidebar.container)).toBeInTheDocument();
      expect(screen.getByTestId(selectors.components.Sidebar.headerTitle)).toBeInTheDocument();
    });

    it('re-hides the sidebar when the temporarily-opened pane closes', () => {
      render(<TestSetup defaultIsHidden />);

      act(() => screen.getByLabelText('Open settings externally').click());
      expect(screen.getByTestId(selectors.components.Sidebar.container)).toBeInTheDocument();

      // Close the pane via the X button
      act(() => screen.getByLabelText('Close').click());

      // Sidebar disappears again — back to the persisted-hidden state
      expect(screen.queryByTestId(selectors.components.Sidebar.container)).not.toBeInTheDocument();
      expect(screen.getByTestId(selectors.components.Sidebar.showHideToggle)).toBeInTheDocument();
    });

    it('shares hidden state across instances via hiddenPersistenceKey', () => {
      const { unmount } = render(<TestSetup persistenceKey="mode-x" hiddenPersistenceKey="shared-hide" />);

      // Hide the sidebar (defaults to visible)
      act(() => screen.getByLabelText('Hide').click());
      expect(screen.getByTestId(selectors.components.Sidebar.showHideToggle)).toBeInTheDocument();

      unmount();

      // A different consumer with a different persistenceKey but the same hiddenPersistenceKey
      // observes the shared hidden state.
      render(<TestSetup persistenceKey="mode-y" hiddenPersistenceKey="shared-hide" />);
      expect(screen.getByTestId(selectors.components.Sidebar.showHideToggle)).toBeInTheDocument();
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

    it('renders the open pane as an undocked overlay (does not push content)', () => {
      render(<TestSetup />);

      act(() => screen.getByLabelText('Settings').click());

      const wrapper = screen.getByTestId('sidebar-test-wrapper');
      // Only the toolbar reserves space; the pane floats over the content as an overlay
      expect(wrapper).toHaveStyle('padding-right: 72px');
    });
  });
});

interface TestSetupProps {
  enableFloating?: boolean;
  persistenceKey?: string;
  defaultIsHidden?: boolean;
  hiddenPersistenceKey?: string;
}

function TestSetup({ persistenceKey, defaultIsHidden, hiddenPersistenceKey, enableFloating }: TestSetupProps) {
  const [openPane, setOpenPane] = React.useState('');
  const [title, setTitle] = React.useState('Settings');
  const contextValue = useSidebar({
    position: 'right',
    enableFloating,
    hasOpenPane: openPane !== '',
    persistenceKey,
    hiddenPersistenceKey,
    onClosePane: () => setOpenPane(''),
    defaultIsHidden,
  });

  return (
    <div {...contextValue.outerWrapperProps} data-testid="sidebar-test-wrapper">
      {/* Button outside the sidebar to simulate opening a pane programmatically (e.g. element selection) */}
      <button onClick={() => setOpenPane('settings')} aria-label="Open settings externally">
        external
      </button>
      <Sidebar contextValue={contextValue}>
        {openPane === 'settings' && (
          <Sidebar.OpenPane>
            <Sidebar.PaneHeader title={title}>
              <button onClick={() => setTitle('Updated settings')}>Apply setting</button>
            </Sidebar.PaneHeader>
          </Sidebar.OpenPane>
        )}
        <Sidebar.Toolbar>
          <Sidebar.Button icon="cog" title="Settings" onClick={() => setOpenPane('settings')} />
          <Sidebar.Button icon="process" title="Data" tooltip="Data transformations" />
          <Sidebar.Button icon="bell" title="Alerts" />
          <Sidebar.Button icon="arrow-to-right" title="Hide" onClick={() => contextValue.setIsHidden(true)} />
        </Sidebar.Toolbar>
      </Sidebar>
    </div>
  );
}
