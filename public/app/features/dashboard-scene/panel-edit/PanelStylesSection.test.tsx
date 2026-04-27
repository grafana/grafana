import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { type ReactNode } from 'react';

import { type FieldConfigSource, LoadingState, type PanelData, type PanelPlugin, type PanelPluginVisualizationSuggestion, ThresholdsMode, getDefaultTimeRange } from '@grafana/data';
import { FieldType, toDataFrame } from '@grafana/data/dataframe';
import { reportInteraction } from '@grafana/runtime';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { getPluginPresets } from 'app/features/panel/presets/getPresets';

import { PanelStylesSection } from './PanelStylesSection';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('app/features/panel/presets/getPresets', () => ({
  getPluginPresets: jest.fn(),
}));

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneGraph: { getData: jest.fn() },
}));

// Mocked to prevent the real component's collapse behavior and hook dependencies (useLocalStorage,
// useQueryParams) from interfering with the tests
jest.mock('app/features/dashboard/components/PanelEditor/OptionsPaneCategory', () => ({
  OptionsPaneCategory: ({ children, renderTitle }: { children: ReactNode; renderTitle?: () => ReactNode }) => (
    <div>
      <div data-testid="category-title">{renderTitle?.()}</div>
      {children}
    </div>
  ),
}));

// VisualizationCardGrid renders panel previews via PanelRenderer, which requires the full
// plugin loading and rendering pipeline. The mock replaces cards with simple buttons so we can test
// PanelStylesSection's selection and click handling
jest.mock('app/features/panel/components/VizTypePicker/VisualizationCardGrid', () => ({
  VisualizationCardGrid: ({
    items,
    onItemClick,
    selectedKey,
    getBadge,
  }: {
    items: PanelPluginVisualizationSuggestion[];
    onItemClick: (item: PanelPluginVisualizationSuggestion, index: number) => void;
    selectedKey?: string;
    getBadge?: (item: PanelPluginVisualizationSuggestion) => React.ReactNode;
  }) => (
    <div>
      {items.map((item, index) => (
        <div key={item.hash} style={{ position: 'relative' }}>
          <button
            data-testid={`preset-${item.hash}`}
            data-selected={selectedKey === item.hash ? 'true' : 'false'}
            onClick={() => onItemClick(item, index)}
          >
            {item.name}
          </button>
          {getBadge?.(item)}
        </div>
      ))}
    </div>
  ),
}));

const mockGetPluginPresets = jest.mocked(getPluginPresets);
const mockSceneGraph = jest.mocked(sceneGraph);
const mockReportInteraction = jest.mocked(reportInteraction);

const fakePlugin = {} as PanelPlugin;

const thresholdPreset: PanelPluginVisualizationSuggestion = {
  pluginId: 'gauge',
  name: 'Standard',
  hash: 'threshold-hash',
  options: {},
  fieldConfig: {
    defaults: {
      thresholds: {
        mode: ThresholdsMode.Percentage,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        steps: [
          { value: null as unknown as number, color: 'green' },
          { value: 80, color: 'red' },
        ],
      },
    },
    overrides: [],
  },
};

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

const mockFieldConfig: FieldConfigSource = { defaults: { custom: { lineWidth: 2 } }, overrides: [] };

function buildPanel(
  fieldConfig: FieldConfigSource = mockFieldConfig,
  getPlugin: () => PanelPlugin | undefined = jest.fn(() => fakePlugin)
) {
  return {
    getPlugin,
    get state() {
      return { fieldConfig };
    },
    onFieldConfigChange: jest.fn(),
  } as unknown as VizPanel;
}

function setupDataMock(data: PanelData | null = mockData) {
  mockSceneGraph.getData.mockReturnValue({ useState: () => ({ data }) } as never);
}

describe('PanelStylesSection', () => {
  const onApplyPreset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPluginPresets.mockReturnValue(mockPresets);
    setupDataMock();
  });

  it('renders null when plugin is not yet loaded', () => {
    const { container } = render(
      <PanelStylesSection
        panel={buildPanel(
          mockFieldConfig,
          jest.fn(() => undefined)
        )}
        onApplyPreset={onApplyPreset}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders null when presets are empty', () => {
    mockGetPluginPresets.mockReturnValue([]);
    const { container } = render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders null when panel data has no series', () => {
    setupDataMock({ ...mockData, series: [] });
    const { container } = render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders null when data is null', () => {
    setupDataMock(null);
    const { container } = render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders null when series exist but all frames have zero rows', () => {
    setupDataMock({
      ...mockData,
      series: [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [] },
            { name: 'value', type: FieldType.number, values: [] },
          ],
        }),
      ],
    });
    const { container } = render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders preset cards when presets and data are available', () => {
    render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    expect(screen.getByTestId('preset-default-hash')).toBeInTheDocument();
    expect(screen.getByTestId('preset-smooth-hash')).toBeInTheDocument();
  });

  it('renders the presets section title', () => {
    render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    expect(screen.getByTestId('category-title')).toHaveTextContent('Panel styles');
  });

  it('passes data series to getPluginPresets', () => {
    render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    expect(mockGetPluginPresets).toHaveBeenCalledWith(fakePlugin, mockData.series);
  });

  it('fires preset_applied interaction when a card is clicked', async () => {
    const user = userEvent.setup();
    render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    await waitFor(() => expect(screen.getByTestId('preset-smooth-hash')).toBeInTheDocument());

    await user.click(screen.getByTestId('preset-smooth-hash'));

    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_viz_preset_applied', {
      pluginId: 'timeseries',
      presetName: 'Smooth',
      presetIndex: 2,
    });
  });

  it('calls onApplyPreset when a card is clicked', async () => {
    const user = userEvent.setup();
    render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);

    await user.click(screen.getByTestId('preset-smooth-hash'));

    expect(onApplyPreset).toHaveBeenCalledWith(mockPresets[1], mockFieldConfig);
  });

  it('does not call onApplyPreset when preset has no fieldConfig and no options', async () => {
    const user = userEvent.setup();
    mockGetPluginPresets.mockReturnValue([{ pluginId: 'timeseries', name: 'No config', hash: 'no-config-hash' }]);

    render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);

    await user.click(screen.getByTestId('preset-no-config-hash'));

    expect(onApplyPreset).not.toHaveBeenCalled();
  });

  it('marks the clicked card as selected', async () => {
    const user = userEvent.setup();
    render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);

    expect(screen.getByTestId('preset-smooth-hash')).toHaveAttribute('data-selected', 'false');

    await user.click(screen.getByTestId('preset-smooth-hash'));

    expect(screen.getByTestId('preset-smooth-hash')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('preset-default-hash')).toHaveAttribute('data-selected', 'false');
  });

  it('shows new presets when panel plugin changes', () => {
    const tablePlugin = { id: 'table' } as unknown as PanelPlugin;
    const tablePresets: PanelPluginVisualizationSuggestion[] = [
      {
        pluginId: 'table',
        name: 'Table preset',
        hash: 'table-preset-hash',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      },
    ];

    let currentPlugin: PanelPlugin | undefined = fakePlugin;
    const panel = buildPanel(mockFieldConfig, () => currentPlugin);

    const { rerender } = render(<PanelStylesSection panel={panel} onApplyPreset={onApplyPreset} />);
    expect(screen.getByTestId('preset-smooth-hash')).toBeInTheDocument();

    currentPlugin = tablePlugin;
    mockGetPluginPresets.mockReturnValue(tablePresets);
    rerender(<PanelStylesSection panel={panel} onApplyPreset={onApplyPreset} />);

    expect(screen.getByTestId('preset-table-preset-hash')).toBeInTheDocument();
    expect(screen.queryByTestId('preset-smooth-hash')).not.toBeInTheDocument();
  });

  describe('threshold badge', () => {
    it('renders a badge for presets that modify thresholds', () => {
      mockGetPluginPresets.mockReturnValue([...mockPresets, thresholdPreset]);
      render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);

      expect(screen.getByLabelText('This preset will modify thresholds')).toBeInTheDocument();
    });

    it('does not render a badge for presets that do not modify thresholds', () => {
      mockGetPluginPresets.mockReturnValue(mockPresets);
      render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);

      expect(screen.queryByLabelText('This preset will modify thresholds')).not.toBeInTheDocument();
    });

    it('renders one badge per threshold-modifying preset', () => {
      const anotherThresholdPreset: PanelPluginVisualizationSuggestion = {
        ...thresholdPreset,
        name: 'Segmented',
        hash: 'threshold-hash-2',
      };
      mockGetPluginPresets.mockReturnValue([...mockPresets, thresholdPreset, anotherThresholdPreset]);
      render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);

      expect(screen.getAllByLabelText('This preset will modify thresholds')).toHaveLength(2);
    });
  });
});
