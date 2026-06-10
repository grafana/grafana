import { screen } from '@testing-library/react';

import { SidebarSize } from '../../constants';
import { type QueryEditorUIState } from '../QueryEditorContext';
import { ds1SettingsMock, makeStackedMode, renderWithQueryEditorProvider } from '../testUtils';

import { Sidebar } from './Sidebar';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: () => ds1SettingsMock,
  }),
}));

describe('QueryEditorSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render bulk actions bar when fewer than 2 items are selected', () => {
    // Default state has no items selected (selectedQueryRefIds = [], selectedTransformationIds = [])
    renderWithQueryEditorProvider(<Sidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />);

    expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).not.toBeInTheDocument();
  });

  it('should call setSidebarSize with Full when toggling from Mini', async () => {
    const setSidebarSize = jest.fn();
    const { user } = renderWithQueryEditorProvider(
      <Sidebar sidebarSize={SidebarSize.Mini} setSidebarSize={setSidebarSize} />
    );

    await user.click(screen.getByRole('button', { name: /toggle sidebar size/i }));

    expect(setSidebarSize).toHaveBeenCalledWith(SidebarSize.Full);
  });

  it('should call setSidebarSize with Mini when toggling from Full', async () => {
    const setSidebarSize = jest.fn();
    const { user } = renderWithQueryEditorProvider(
      <Sidebar sidebarSize={SidebarSize.Full} setSidebarSize={setSidebarSize} />
    );

    await user.click(screen.getByRole('button', { name: /toggle sidebar size/i }));

    expect(setSidebarSize).toHaveBeenCalledWith(SidebarSize.Mini);
  });

  describe('stacked view action', () => {
    it('renders as inactive (aria-pressed=false) when stacked mode is disabled', () => {
      renderWithQueryEditorProvider(<Sidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />, {
        uiStateOverrides: {
          stackedMode: makeStackedMode({ enabled: false }),
        } satisfies Partial<QueryEditorUIState>,
      });

      expect(screen.getByRole('button', { name: /enter stacked view/i })).toHaveAttribute('aria-pressed', 'false');
    });

    it('renders as active (aria-pressed=true) when stacked mode is enabled', () => {
      renderWithQueryEditorProvider(<Sidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />, {
        uiStateOverrides: {
          stackedMode: makeStackedMode({ enabled: true }),
        } satisfies Partial<QueryEditorUIState>,
      });

      expect(screen.getByRole('button', { name: /exit stacked view/i })).toHaveAttribute('aria-pressed', 'true');
    });

    it('clicking enters stacked mode when currently disabled', async () => {
      const enter = jest.fn();
      const { user } = renderWithQueryEditorProvider(
        <Sidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />,
        {
          uiStateOverrides: {
            stackedMode: makeStackedMode({ enter }),
          } satisfies Partial<QueryEditorUIState>,
        }
      );

      await user.click(screen.getByRole('button', { name: /enter stacked view/i }));

      expect(enter).toHaveBeenCalled();
    });

    it('clicking exits stacked mode when currently enabled', async () => {
      const exit = jest.fn();
      const { user } = renderWithQueryEditorProvider(
        <Sidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />,
        {
          uiStateOverrides: {
            stackedMode: makeStackedMode({ enabled: true, exit }),
          } satisfies Partial<QueryEditorUIState>,
        }
      );

      await user.click(screen.getByRole('button', { name: /exit stacked view/i }));

      expect(exit).toHaveBeenCalled();
    });
  });
});
