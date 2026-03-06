import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';

import {
  FieldConfigSource,
  FieldType,
  LoadingState,
  PanelData,
  PanelPlugin,
  PanelPluginVisualizationSuggestion,
  getDefaultTimeRange,
  toDataFrame,
} from '@grafana/data';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import { getPluginPresets } from 'app/features/panel/presets/getPresets';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

import { PanelStylesSection } from './PanelStylesSection';

jest.mock('app/features/plugins/importPanelPlugin', () => ({
  importPanelPlugin: jest.fn(),
}));

jest.mock('app/features/panel/presets/getPresets', () => ({
  getPluginPresets: jest.fn(),
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

const mockImportPanelPlugin = jest.mocked(importPanelPlugin);
const mockGetPluginPresets = jest.mocked(getPluginPresets);
const mockSceneGraph = jest.mocked(sceneGraph);

const fakePlugin = {} as PanelPlugin;

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

function buildPanel(pluginId = 'timeseries', fieldConfig: FieldConfigSource = mockFieldConfig) {
  return {
    useState: () => ({ pluginId, fieldConfig }),
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
    mockImportPanelPlugin.mockResolvedValue(fakePlugin);
    mockGetPluginPresets.mockReturnValue(mockPresets);
    setupDataMock();
  });

  it('renders null while presets are loading', () => {
    mockImportPanelPlugin.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders null when presets are empty', async () => {
    mockGetPluginPresets.mockReturnValue([]);
    const { container } = render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    await waitFor(() => expect(mockImportPanelPlugin).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders null when panel data has no series', async () => {
    setupDataMock({ ...mockData, series: [] });
    const { container } = render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    await waitFor(() => expect(mockImportPanelPlugin).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders null when data is null', async () => {
    setupDataMock(null);
    const { container } = render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    await waitFor(() => expect(mockImportPanelPlugin).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders preset cards when presets and data are available', async () => {
    render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    await waitFor(() => {
      expect(screen.getByTestId('preset-default-hash')).toBeInTheDocument();
      expect(screen.getByTestId('preset-smooth-hash')).toBeInTheDocument();
    });
  });

  it('renders the presets section title', async () => {
    render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    await waitFor(() => {
      expect(screen.getByTestId('category-title')).toHaveTextContent('Panel styles');
    });
  });

  it('loads the plugin with the panel pluginId and gets its presets', async () => {
    render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    await waitFor(() => expect(mockImportPanelPlugin).toHaveBeenCalledWith('timeseries'));
    expect(mockGetPluginPresets).toHaveBeenCalledWith(fakePlugin, mockFieldConfig);
  });

  it('calls onApplyPreset when a card is clicked', async () => {
    const user = userEvent.setup();
    render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    await waitFor(() => expect(screen.getByTestId('preset-smooth-hash')).toBeInTheDocument());

    await user.click(screen.getByTestId('preset-smooth-hash'));

    expect(onApplyPreset).toHaveBeenCalledWith(mockPresets[1], mockFieldConfig);
  });

  it('does not call onApplyPreset when preset has no fieldConfig and no options', async () => {
    const user = userEvent.setup();
    mockGetPluginPresets.mockReturnValue([{ pluginId: 'timeseries', name: 'No config', hash: 'no-config-hash' }]);

    render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    await waitFor(() => expect(screen.getByTestId('preset-no-config-hash')).toBeInTheDocument());

    await user.click(screen.getByTestId('preset-no-config-hash'));

    expect(onApplyPreset).not.toHaveBeenCalled();
  });

  it('calls onApplyPreset when preset has options but no fieldConfig', async () => {
    const user = userEvent.setup();
    const presetsWithOptionsOnly: PanelPluginVisualizationSuggestion[] = [
      { pluginId: 'gauge', name: 'Only options', hash: 'only-options-hash', options: { barShape: 'rounded' } },
    ];
    mockGetPresets.mockResolvedValue(presetsWithOptionsOnly);

    render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
    await waitFor(() => expect(screen.getByTestId('preset-only-options-hash')).toBeInTheDocument());

    await user.click(screen.getByTestId('preset-only-options-hash'));

    expect(onApplyPreset).toHaveBeenCalledWith(presetsWithOptionsOnly[0], mockFieldConfig);
  });

  it('marks the clicked card as selected', async () => {
    const user = userEvent.setup();
    render(<PanelStylesSection panel={buildPanel()} onApplyPreset={onApplyPreset} />);
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
      useState: () => ({ pluginId, fieldConfig: mockFieldConfig }),
      get state() {
        return { fieldConfig: mockFieldConfig };
      },
      onFieldConfigChange: jest.fn(),
    } as unknown as VizPanel;

    const { rerender } = render(<PanelStylesSection panel={panel} onApplyPreset={onApplyPreset} />);
    await waitFor(() => expect(screen.getByTestId('preset-smooth-hash')).toBeInTheDocument());

    await user.click(screen.getByTestId('preset-smooth-hash'));
    expect(screen.getByTestId('preset-smooth-hash')).toHaveAttribute('data-selected', 'true');

    pluginId = 'table';
    mockGetPluginPresets.mockReturnValue([
      {
        pluginId: 'table',
        name: 'Table preset',
        hash: 'table-preset-hash',
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
      },
    ]);

    rerender(<PanelStylesSection panel={panel} onApplyPreset={onApplyPreset} />);
    await waitFor(() => expect(screen.getByTestId('preset-table-preset-hash')).toBeInTheDocument());

    expect(screen.queryByTestId('preset-smooth-hash')).not.toBeInTheDocument();
  });
});
