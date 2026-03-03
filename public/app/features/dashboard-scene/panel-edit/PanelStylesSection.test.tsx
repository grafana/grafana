import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';

import {
  FieldType,
  LoadingState,
  PanelData,
  PanelPluginVisualizationSuggestion,
  getDefaultTimeRange,
  toDataFrame,
} from '@grafana/data';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import { getPresets } from 'app/features/panel/presets/getPresets';

import { dashboardEditActions } from '../edit-pane/shared';

import { PanelStylesSection } from './PanelStylesSection';

jest.mock('app/features/panel/presets/getPresets', () => ({
  getPresets: jest.fn(),
}));

jest.mock('../edit-pane/shared', () => ({
  dashboardEditActions: { edit: jest.fn() },
}));

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneGraph: { getData: jest.fn() },
}));

jest.mock('app/features/dashboard/components/PanelEditor/OptionsPaneCategory', () => ({
  OptionsPaneCategory: ({ children, renderTitle }: { children: ReactNode; renderTitle?: () => ReactNode }) => (
    <div>
      <div data-testid="category-title">{renderTitle?.()}</div>
      {children}
    </div>
  ),
}));

jest.mock('app/features/panel/components/VizTypePicker/VisualizationCardGrid', () => ({
  VisualizationCardGrid: ({
    items,
    onItemClick,
    selectedKey,
  }: {
    items: PanelPluginVisualizationSuggestion[];
    onItemClick: (item: PanelPluginVisualizationSuggestion) => void;
    selectedKey?: string;
  }) => (
    <div>
      {items.map((item) => (
        <button
          key={item.hash}
          data-testid={`preset-${item.hash}`}
          data-selected={selectedKey === item.hash ? 'true' : 'false'}
          onClick={() => onItemClick(item)}
        >
          {item.name}
        </button>
      ))}
    </div>
  ),
}));

const mockGetPresets = jest.mocked(getPresets);
const mockDashboardEditActions = jest.mocked(dashboardEditActions);
const mockSceneGraph = jest.mocked(sceneGraph);

const mockPresets: PanelPluginVisualizationSuggestion[] = [
  {
    pluginId: 'timeseries',
    name: 'Default',
    hash: 'default-hash',
    options: {},
    fieldConfig: { defaults: { custom: {} }, overrides: [] },
  },
  {
    pluginId: 'timeseries',
    name: 'Smooth',
    hash: 'smooth-hash',
    options: {},
    fieldConfig: { defaults: { custom: { lineWidth: 1, fillOpacity: 24 } }, overrides: [] },
  },
];

const mockData: PanelData = {
  series: [
    toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'value', type: FieldType.number, values: [10, 20, 30] },
      ],
    }),
  ],
  state: LoadingState.Done,
  timeRange: getDefaultTimeRange(),
  structureRev: 1,
};

const mockFieldConfig = { defaults: { custom: { lineWidth: 2 } }, overrides: [] };

function buildPanel(pluginId = 'timeseries') {
  return {
    useState: () => ({ pluginId }),
    state: { fieldConfig: mockFieldConfig },
    onFieldConfigChange: jest.fn(),
  } as unknown as VizPanel;
}

function setupDataMock(data: PanelData | null = mockData) {
  mockSceneGraph.getData.mockReturnValue({ useState: () => ({ data }) } as never);
}

describe('PanelStylesSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPresets.mockResolvedValue(mockPresets);
    setupDataMock();
  });

  it('renders null while presets are loading', () => {
    mockGetPresets.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(<PanelStylesSection panel={buildPanel()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders null when presets are empty', async () => {
    mockGetPresets.mockResolvedValue([]);
    const { container } = render(<PanelStylesSection panel={buildPanel()} />);
    await waitFor(() => expect(mockGetPresets).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders null when panel data has no series', async () => {
    setupDataMock({ ...mockData, series: [] });
    const { container } = render(<PanelStylesSection panel={buildPanel()} />);
    await waitFor(() => expect(mockGetPresets).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders null when no data', async () => {
    setupDataMock(null);
    const { container } = render(<PanelStylesSection panel={buildPanel()} />);
    await waitFor(() => expect(mockGetPresets).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders preset cards when presets and data are available', async () => {
    render(<PanelStylesSection panel={buildPanel()} />);
    await waitFor(() => {
      expect(screen.getByTestId('preset-default-hash')).toBeInTheDocument();
      expect(screen.getByTestId('preset-smooth-hash')).toBeInTheDocument();
    });
  });

  it('renders the presets section title', async () => {
    render(<PanelStylesSection panel={buildPanel()} />);
    await waitFor(() => {
      expect(screen.getByTestId('category-title')).toHaveTextContent('Panel styles');
    });
  });

  it('calls getPresets with the panel pluginId', async () => {
    render(<PanelStylesSection panel={buildPanel()} />);
    await waitFor(() => expect(mockGetPresets).toHaveBeenCalledWith('timeseries', mockFieldConfig));
  });

  it('applies a preset when a card is clicked', async () => {
    const user = userEvent.setup();
    const panel = buildPanel();
    mockDashboardEditActions.edit.mockImplementation((props) => props.perform());

    render(<PanelStylesSection panel={panel} />);
    await waitFor(() => expect(screen.getByTestId('preset-smooth-hash')).toBeInTheDocument());

    await user.click(screen.getByTestId('preset-smooth-hash'));

    expect(mockDashboardEditActions.edit).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.any(String) })
    );
    expect(panel.onFieldConfigChange).toHaveBeenCalledWith(mockPresets[1].fieldConfig, true);
  });

  it('does not call onFieldConfigChange when preset has no fieldConfig', async () => {
    const user = userEvent.setup();
    const panel = buildPanel();
    const presetsWithoutFieldConfig: PanelPluginVisualizationSuggestion[] = [
      { pluginId: 'timeseries', name: 'No Config', hash: 'no-config-hash', options: {} },
    ];
    mockGetPresets.mockResolvedValue(presetsWithoutFieldConfig);
    mockDashboardEditActions.edit.mockImplementation((props) => props.perform());

    render(<PanelStylesSection panel={panel} />);
    await waitFor(() => expect(screen.getByTestId('preset-no-config-hash')).toBeInTheDocument());

    await user.click(screen.getByTestId('preset-no-config-hash'));

    expect(panel.onFieldConfigChange).not.toHaveBeenCalled();
  });

  it('marks the clicked card as selected', async () => {
    const user = userEvent.setup();
    render(<PanelStylesSection panel={buildPanel()} />);
    await waitFor(() => expect(screen.getByTestId('preset-smooth-hash')).toBeInTheDocument());

    expect(screen.getByTestId('preset-smooth-hash')).toHaveAttribute('data-selected', 'false');

    await user.click(screen.getByTestId('preset-smooth-hash'));

    expect(screen.getByTestId('preset-smooth-hash')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('preset-default-hash')).toHaveAttribute('data-selected', 'false');
  });

  it('resets selection and reloads presets when pluginId changes', async () => {
    const user = userEvent.setup();
    let pluginId = 'timeseries';
    const panel = {
      useState: () => ({ pluginId }),
      state: { fieldConfig: mockFieldConfig },
      onFieldConfigChange: jest.fn(),
    } as unknown as VizPanel;

    const { rerender } = render(<PanelStylesSection panel={panel} />);
    await waitFor(() => expect(screen.getByTestId('preset-smooth-hash')).toBeInTheDocument());

    await user.click(screen.getByTestId('preset-smooth-hash'));
    expect(screen.getByTestId('preset-smooth-hash')).toHaveAttribute('data-selected', 'true');

    pluginId = 'table';
    mockGetPresets.mockResolvedValue([
      {
        pluginId: 'table',
        name: 'Table preset',
        hash: 'table-preset-hash',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      },
    ]);

    rerender(<PanelStylesSection panel={panel} />);
    await waitFor(() => expect(screen.getByTestId('preset-table-preset-hash')).toBeInTheDocument());

    expect(screen.queryByTestId('preset-smooth-hash')).not.toBeInTheDocument();
  });
});
