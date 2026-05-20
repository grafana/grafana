import { screen } from '@testing-library/react';

import { SidebarSize } from '../../constants';
import { type QueryEditorUIState } from '../QueryEditorContext';
import { ds1SettingsMock, renderWithQueryEditorProvider } from '../testUtils';

import { Sidebar } from './Sidebar';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: () => ds1SettingsMock,
  }),
}));

function stackedModeOverrides(overrides = {}) {
  return {
    enabled: false,
    enter: jest.fn(),
    exit: jest.fn(),
    syncActiveItem: jest.fn(),
    scrollTarget: null,
    requestScroll: jest.fn(),
    clearScrollTarget: jest.fn(),
    ...overrides,
  };
}

describe('QueryEditorSidebar', () => {
  afterAll(() => {
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

  it('renders a stacked view action in the Data view', async () => {
    const enterStackedMode = jest.fn();
    const { user } = renderWithQueryEditorProvider(
      <Sidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />,
      {
        uiStateOverrides: {
          stackedMode: stackedModeOverrides({ enter: enterStackedMode }),
        } satisfies Partial<QueryEditorUIState>,
      }
    );

    await user.click(screen.getByRole('button', { name: /enter stacked view/i }));

    expect(enterStackedMode).toHaveBeenCalled();
  });

  it('shows the stacked view action as active and exits stacked view when clicked', async () => {
    const exitStackedMode = jest.fn();
    const { user } = renderWithQueryEditorProvider(
      <Sidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />,
      {
        uiStateOverrides: {
          stackedMode: stackedModeOverrides({ enabled: true, exit: exitStackedMode }),
        } satisfies Partial<QueryEditorUIState>,
      }
    );

    const stackedButton = screen.getByRole('button', { name: /exit stacked view/i });
    expect(stackedButton).toHaveAttribute('aria-pressed', 'true');

    await user.click(stackedButton);

    expect(exitStackedMode).toHaveBeenCalled();
  });
});
