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

  describe('auto-hide behavior', () => {
    let onClosePaneMock = jest.fn();

    beforeEach(() => {
      onClosePaneMock = jest.fn();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should auto-hide sidebar after inactivity timeout', async () => {
      render(<TestSetup autoHide={true} onClosePaneMock={onClosePaneMock} />);
      act(() => screen.getByLabelText('Settings').click());
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      act(() => jest.advanceTimersByTime(10000));
      expect(onClosePaneMock).toHaveBeenCalledTimes(1);
    });

    it('should respect auto-hide timer configuration', async () => {
      render(<TestSetup autoHide={true} autoHideTimeout={5000} onClosePaneMock={onClosePaneMock} />);
      act(() => screen.getByLabelText('Settings').click());
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      act(() => jest.advanceTimersByTime(5000));
      expect(onClosePaneMock).toHaveBeenCalledTimes(1);
    });

    it('should reset auto-hide timer on user interaction', async () => {
      render(<TestSetup autoHide={true} onClosePaneMock={onClosePaneMock} />);
      act(() => screen.getByLabelText('Settings').click());
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      act(() => jest.advanceTimersByTime(9500));
      act(() => screen.getByTestId('sidebar-pane-header-title').click());
      act(() => jest.advanceTimersByTime(9500));
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      expect(onClosePaneMock).not.toHaveBeenCalled();
      act(() => jest.advanceTimersByTime(500));
      expect(onClosePaneMock).toHaveBeenCalledTimes(1);
    });

    it('should not auto-hide when autoHide is disabled', async () => {
      render(<TestSetup autoHide={false} onClosePaneMock={onClosePaneMock} />);
      act(() => screen.getByLabelText('Settings').click());
      act(() => jest.advanceTimersByTime(20000));
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      expect(onClosePaneMock).not.toHaveBeenCalled();
    });

    it('should clear auto-hide timer when pane is closed manually', async () => {
      render(<TestSetup autoHide={true} onClosePaneMock={onClosePaneMock} />);
      act(() => screen.getByLabelText('Settings').click());
      act(() => screen.getByLabelText('Close').click());
      act(() => jest.advanceTimersByTime(20000));
      expect(onClosePaneMock).toHaveBeenCalledTimes(1);
    });

    it('should not auto-hide when sidebar is docked', async () => {
      render(<TestSetup autoHide={true} onClosePaneMock={onClosePaneMock} />);
      act(() => screen.getByLabelText('Settings').click());
      act(() => screen.getByLabelText('Dock').click());
      act(() => jest.advanceTimersByTime(20000));
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      expect(onClosePaneMock).not.toHaveBeenCalled();
    });

    it('should pause auto-hide when pauseAutoHide is called', async () => {
      render(<TestSetup autoHide={true} onClosePaneMock={onClosePaneMock} exposePauseResume={true} />);
      act(() => screen.getByLabelText('Settings').click());
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      act(() => screen.getByTestId('pause-autohide-button').click());
      act(() => jest.advanceTimersByTime(20000));
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      expect(onClosePaneMock).not.toHaveBeenCalled();
    });

    it('should resume auto-hide when resumeAutoHide is called', async () => {
      render(<TestSetup autoHide={true} onClosePaneMock={onClosePaneMock} exposePauseResume={true} />);
      act(() => screen.getByLabelText('Settings').click());
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      act(() => screen.getByTestId('pause-autohide-button').click());
      act(() => jest.advanceTimersByTime(20000));
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      expect(onClosePaneMock).not.toHaveBeenCalled();
      act(() => screen.getByTestId('resume-autohide-button').click());
      act(() => jest.advanceTimersByTime(10000));
      expect(onClosePaneMock).toHaveBeenCalledTimes(1);
    });

    it('should clear timer when pausing auto-hide', async () => {
      render(<TestSetup autoHide={true} onClosePaneMock={onClosePaneMock} exposePauseResume={true} />);
      act(() => screen.getByLabelText('Settings').click());
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      act(() => jest.advanceTimersByTime(5000));
      act(() => screen.getByTestId('pause-autohide-button').click());
      act(() => jest.advanceTimersByTime(10000));
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      expect(onClosePaneMock).not.toHaveBeenCalled();
    });

    it('should start fresh timer when resuming auto-hide', async () => {
      render(
        <TestSetup autoHide={true} autoHideTimeout={5000} onClosePaneMock={onClosePaneMock} exposePauseResume={true} />
      );
      act(() => screen.getByLabelText('Settings').click());
      act(() => screen.getByLabelText('Settings').click());
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      act(() => screen.getByTestId('pause-autohide-button').click());
      act(() => jest.advanceTimersByTime(30000));
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      expect(onClosePaneMock).not.toHaveBeenCalled();
      act(() => screen.getByTestId('resume-autohide-button').click());
      act(() => jest.advanceTimersByTime(4999));
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      expect(onClosePaneMock).not.toHaveBeenCalled();
      act(() => jest.advanceTimersByTime(1));
      expect(onClosePaneMock).toHaveBeenCalledTimes(1);
    });

    it('should not start timer on resume if pane is closed', async () => {
      render(<TestSetup autoHide={true} onClosePaneMock={onClosePaneMock} exposePauseResume={true} />);
      act(() => screen.getByLabelText('Settings').click());
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      act(() => screen.getByTestId('pause-autohide-button').click());
      act(() => screen.getByLabelText('Close').click());
      expect(onClosePaneMock).toHaveBeenCalledTimes(1);
      act(() => screen.getByTestId('resume-autohide-button').click());
      act(() => jest.advanceTimersByTime(20000));
      expect(onClosePaneMock).toHaveBeenCalledTimes(1);
    });

    it('should not reset timer on activity when paused', async () => {
      render(<TestSetup autoHide={true} onClosePaneMock={onClosePaneMock} exposePauseResume={true} />);
      act(() => screen.getByLabelText('Settings').click());
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      act(() => screen.getByTestId('pause-autohide-button').click());
      act(() => screen.getByTestId('sidebar-pane-header-title').click());
      act(() => jest.advanceTimersByTime(20000));
      expect(screen.getByTestId('sidebar-pane-header-title')).toBeInTheDocument();
      expect(onClosePaneMock).not.toHaveBeenCalled();
    });
  });
});

interface TestSetupProps {
  persistanceKey?: string;
  autoHide?: boolean;
  autoHideTimeout?: number;
  onClosePaneMock?: jest.Mock;
  exposePauseResume?: boolean;
}

function TestSetup({ persistanceKey, autoHide, autoHideTimeout, onClosePaneMock, exposePauseResume }: TestSetupProps) {
  const [openPane, setOpenPane] = React.useState('');
  const contextValue = useSidebar({
    position: 'right',
    hasOpenPane: openPane !== '',
    persistanceKey,
    onClosePane: () => {
      setOpenPane('');
      onClosePaneMock?.();
    },
    autoHide,
    autoHideTimeout,
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
      {exposePauseResume && (
        <>
          <button data-testid="pause-autohide-button" onClick={contextValue.pauseAutoHide}>
            Pause AutoHide
          </button>
          <button data-testid="resume-autohide-button" onClick={contextValue.resumeAutoHide}>
            Resume AutoHide
          </button>
        </>
      )}
    </div>
  );
}
