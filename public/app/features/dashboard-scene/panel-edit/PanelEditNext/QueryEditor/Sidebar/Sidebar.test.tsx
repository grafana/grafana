import { screen } from '@testing-library/react';

import { reportInteraction } from '@grafana/runtime';

import { SidebarSize } from '../../constants';
import { type QueryEditorUIState } from '../QueryEditorContext';
import { ds1SettingsMock, makeStackedMode, renderWithQueryEditorProvider } from '../testUtils';

import { Sidebar } from './Sidebar';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: () => ds1SettingsMock,
  }),
  reportInteraction: jest.fn(),
}));

const mockReportInteraction = jest.mocked(reportInteraction);

describe('QueryEditorSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('header view toggle at narrow widths', () => {
    // jsdom does no layout; drive the header's overflow measurement via the prototype getters.
    function mockMeasuredWidths({ contentWidth, containerWidth }: { contentWidth: number; containerWidth: number }) {
      jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(contentWidth);
      jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(containerWidth);
    }

    it('shows tab labels when the toggle fits', () => {
      mockMeasuredWidths({ contentWidth: 150, containerWidth: 200 });
      renderWithQueryEditorProvider(<Sidebar sidebarSize={SidebarSize.Mini} setSidebarSize={jest.fn()} />);

      expect(screen.getByRole('radio', { name: 'Data' })).toHaveTextContent('Data');
    });

    it('drops tab labels but keeps accessible names when the toggle overflows', () => {
      mockMeasuredWidths({ contentWidth: 150, containerWidth: 100 });
      renderWithQueryEditorProvider(<Sidebar sidebarSize={SidebarSize.Mini} setSidebarSize={jest.fn()} />);

      const dataTab = screen.getByRole('radio', { name: 'Data' });
      expect(dataTab).not.toHaveTextContent('Data');
    });
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

    it('tracks an interaction when entering stacked mode', async () => {
      const { user } = renderWithQueryEditorProvider(
        <Sidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />,
        {
          uiStateOverrides: {
            stackedMode: makeStackedMode({ enabled: false }),
          } satisfies Partial<QueryEditorUIState>,
        }
      );

      await user.click(screen.getByRole('button', { name: /enter stacked view/i }));

      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_panel_edit_next_interaction', {
        action: 'toggle_stacked_view',
        direction: 'enter',
      });
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

    it('tracks an interaction when exiting stacked mode', async () => {
      const { user } = renderWithQueryEditorProvider(
        <Sidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />,
        {
          uiStateOverrides: {
            stackedMode: makeStackedMode({ enabled: true }),
          } satisfies Partial<QueryEditorUIState>,
        }
      );

      await user.click(screen.getByRole('button', { name: /exit stacked view/i }));

      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_panel_edit_next_interaction', {
        action: 'toggle_stacked_view',
        direction: 'exit',
      });
    });
  });
});
