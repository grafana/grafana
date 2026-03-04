import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LoadingState, PanelData, PanelModel, toDataFrame, FieldType, getDefaultTimeRange } from '@grafana/data';
import { UNCONFIGURED_PANEL_PLUGIN_ID } from 'app/features/dashboard-scene/scene/UnconfiguredPanel';

import * as getAllSuggestionsModule from '../../suggestions/getAllSuggestions';

import { VisualizationSuggestions } from './VisualizationSuggestions';
import { PANEL_STATES, VizSuggestionsInteractions } from './interactions';

jest.mock('../../suggestions/getAllSuggestions');
jest.mock('./interactions', () => ({
  ...jest.requireActual('./interactions'),
  VizSuggestionsInteractions: {
    suggestionAccepted: jest.fn(),
    suggestionPreviewed: jest.fn(),
  },
}));
jest.mock('./VisualizationSuggestionCard', () => ({
  VisualizationSuggestionCard: ({
    suggestion,
    onClick,
  }: {
    suggestion: { name: string; hash: string };
    onClick: () => void;
  }) => (
    <div data-testid={`suggestion-card-${suggestion.hash}`} onClick={onClick}>
      {suggestion.name}
    </div>
  ),
}));
jest.mock('./VizTypePickerPlugin', () => ({
  VizTypePickerPlugin: ({ plugin, onSelect }: { plugin: { id: string; name: string }; onSelect: () => void }) => (
    <button data-testid={`no-data-panel-${plugin.id}`} onClick={() => onSelect()}>
      {plugin.name}
    </button>
  ),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    featureToggles: {
      newVizSuggestions: true,
    },
  },
}));

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useListedPanelPluginMetas: jest.fn().mockReturnValue({
    loading: false,
    error: undefined,
    value: [
      { id: 'timeseries', name: 'Time series', sort: 0, hideFromList: false },
      { id: 'text', name: 'Text', sort: 1, hideFromList: false },
      { id: 'dashlist', name: 'Dashboard list', sort: 2, hideFromList: false },
      { id: 'alertlist', name: 'Alert list', sort: 3, hideFromList: false },
    ],
  }),
}));

describe('VisualizationSuggestions', () => {
  const mockGetAllSuggestions = jest.spyOn(getAllSuggestionsModule, 'getAllSuggestions');

  beforeEach(() => {
    mockGetAllSuggestions.mockClear();
    mockGetAllSuggestions.mockResolvedValue({
      suggestions: [
        {
          pluginId: 'timeseries',
          name: 'Time series',
          hash: 'test-hash',
          options: {},
        },
      ],
      hasErrors: false,
    });
  });

  it('should not regenerate suggestions when values change while streaming', async () => {
    const initialData: PanelData = {
      series: [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3] },
            { name: 'value', type: FieldType.number, values: [10, 20, 30] },
          ],
        }),
      ],
      state: LoadingState.Streaming,
      timeRange: getDefaultTimeRange(),
      structureRev: 1,
    };

    const { rerender } = render(
      <VisualizationSuggestions
        onChange={jest.fn()}
        data={initialData}
        panel={undefined}
        searchQuery=""
        isNewPanel={false}
      />
    );

    await waitFor(() => {
      expect(mockGetAllSuggestions).toHaveBeenCalledTimes(1);
    });

    const streamingData: PanelData = {
      series: [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3, 4] },
            { name: 'value', type: FieldType.number, values: [10, 20, 30, 40] },
          ],
        }),
      ],
      state: LoadingState.Streaming,
      timeRange: getDefaultTimeRange(),
      structureRev: 1,
    };

    rerender(
      <VisualizationSuggestions
        onChange={jest.fn()}
        data={streamingData}
        panel={undefined}
        searchQuery=""
        isNewPanel={false}
      />
    );

    expect(mockGetAllSuggestions).toHaveBeenCalledTimes(1);
  });

  it('should regenerate suggestions when data structure changes', async () => {
    const initialData: PanelData = {
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

    const { rerender } = render(
      <VisualizationSuggestions
        onChange={jest.fn()}
        data={initialData}
        panel={undefined}
        searchQuery=""
        isNewPanel={false}
      />
    );

    await waitFor(() => {
      expect(mockGetAllSuggestions).toHaveBeenCalled();
    });

    const callCountBeforeChange = mockGetAllSuggestions.mock.calls.length;

    const structureChangedData: PanelData = {
      series: [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3] },
            { name: 'value', type: FieldType.number, values: [10, 20, 30] },
            { name: 'newField', type: FieldType.string, values: ['a', 'b', 'c'] },
          ],
        }),
      ],
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
      structureRev: 2,
    };

    rerender(
      <VisualizationSuggestions
        onChange={jest.fn()}
        data={structureChangedData}
        panel={undefined}
        searchQuery=""
        isNewPanel={false}
      />
    );

    await waitFor(() => {
      expect(mockGetAllSuggestions.mock.calls.length).toBeGreaterThan(callCountBeforeChange);
    });
  });

  it('should call onChange for new panels (unconfigured)', async () => {
    const mockOnChange = jest.fn();
    const unconfiguredPanel = { type: UNCONFIGURED_PANEL_PLUGIN_ID } as PanelModel;
    const data: PanelData = {
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

    render(
      <VisualizationSuggestions onChange={mockOnChange} data={data} panel={unconfiguredPanel} isNewPanel={true} />
    );

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  it('should not call onChange for existing panels', async () => {
    const mockOnChange = jest.fn();
    const existingPanel = { type: 'timeseries' } as PanelModel;
    const data: PanelData = {
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

    render(<VisualizationSuggestions onChange={mockOnChange} data={data} panel={existingPanel} isNewPanel={false} />);

    // Wait for suggestions to load
    await waitFor(() => {
      expect(mockGetAllSuggestions).toHaveBeenCalled();
    });

    // Wait for any potential state updates to complete
    await waitFor(
      () => {
        // If onChange was going to be called, it would have been by now
        expect(mockOnChange).not.toHaveBeenCalled();
      },
      { timeout: 500 }
    );
  });

  it('should call onChange for unconfigured panels', async () => {
    const mockOnChange = jest.fn();
    const unconfiguredPanel = { type: UNCONFIGURED_PANEL_PLUGIN_ID } as PanelModel;
    const data: PanelData = {
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

    render(
      <VisualizationSuggestions onChange={mockOnChange} data={data} panel={unconfiguredPanel} isNewPanel={false} />
    );

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  it('should not auto-select when there is no data (unconfigured panel)', async () => {
    const mockOnChange = jest.fn();
    const unconfiguredPanel = { type: UNCONFIGURED_PANEL_PLUGIN_ID } as PanelModel;
    const emptyData: PanelData = {
      series: [],
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
      structureRev: 1,
    };

    render(
      <VisualizationSuggestions onChange={mockOnChange} data={emptyData} panel={unconfiguredPanel} isNewPanel={true} />
    );

    await waitFor(() => {
      expect(mockGetAllSuggestions).toHaveBeenCalled();
    });

    await waitFor(
      () => {
        expect(mockOnChange).not.toHaveBeenCalled();
      },
      { timeout: 500 }
    );
  });

  it('should auto-select the first suggestion only after real data arrives', async () => {
    const mockOnChange = jest.fn();
    const unconfiguredPanel = { type: UNCONFIGURED_PANEL_PLUGIN_ID } as PanelModel;
    const emptyData: PanelData = {
      series: [],
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
      structureRev: 1,
    };

    mockGetAllSuggestions.mockResolvedValueOnce({
      suggestions: [{ pluginId: 'table', name: 'Table', hash: 'table-hash', options: {} }],
      hasErrors: false,
    });
    mockGetAllSuggestions.mockResolvedValueOnce({
      suggestions: [
        { pluginId: 'timeseries', name: 'Line chart', hash: 'timeseries-hash', options: {} },
        { pluginId: 'table', name: 'Table', hash: 'table-hash', options: {} },
      ],
      hasErrors: false,
    });

    const { rerender } = render(
      <VisualizationSuggestions onChange={mockOnChange} data={emptyData} panel={unconfiguredPanel} isNewPanel={true} />
    );

    await waitFor(() => {
      expect(mockGetAllSuggestions).toHaveBeenCalledTimes(1);
    });

    await waitFor(
      () => {
        expect(mockOnChange).not.toHaveBeenCalled();
      },
      { timeout: 500 }
    );

    const testData: PanelData = {
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
      structureRev: 2,
    };

    rerender(
      <VisualizationSuggestions onChange={mockOnChange} data={testData} panel={unconfiguredPanel} isNewPanel={true} />
    );

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'timeseries' }));
    });
  });

  it('should show an error alert when suggestions fail to load', async () => {
    mockGetAllSuggestions.mockRejectedValue(new Error('Network error'));

    const data: PanelData = {
      series: [],
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
    };

    render(<VisualizationSuggestions onChange={jest.fn()} data={data} panel={undefined} searchQuery="" />);

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    mockGetAllSuggestions.mockResolvedValue({
      suggestions: [{ pluginId: 'timeseries', name: 'Time series', hash: 'test-hash', options: {} }],
      hasErrors: false,
    });
  });

  it('should show a warning alert when some suggestions could not be loaded', async () => {
    mockGetAllSuggestions.mockResolvedValue({
      suggestions: [{ pluginId: 'timeseries', name: 'Time series', hash: 'test-hash', options: {} }],
      hasErrors: true,
    });

    const data: PanelData = {
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

    render(<VisualizationSuggestions onChange={jest.fn()} data={data} panel={undefined} searchQuery="" />);

    await waitFor(() => {
      expect(screen.getByText('Some suggestions could not be loaded')).toBeInTheDocument();
    });
  });

  it('should filter suggestions by search query when data has series', async () => {
    mockGetAllSuggestions.mockResolvedValue({
      suggestions: [
        { pluginId: 'timeseries', name: 'Time series', hash: 'ts-hash', options: {} },
        { pluginId: 'table', name: 'Table', hash: 'table-hash', options: {} },
      ],
      hasErrors: false,
    });

    const data: PanelData = {
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

    render(<VisualizationSuggestions onChange={jest.fn()} data={data} panel={undefined} searchQuery="time" />);

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-card-ts-hash')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('suggestion-card-table-hash')).not.toBeInTheDocument();
  });

  it('should call onChange with withModKey: false when a suggestion card is clicked', async () => {
    const mockOnChange = jest.fn();
    const dataWithSeries: PanelData = {
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

    render(<VisualizationSuggestions onChange={mockOnChange} data={dataWithSeries} panel={undefined} searchQuery="" />);

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-card-test-hash')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('suggestion-card-test-hash'));

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'timeseries', withModKey: false }));
  });

  it('should report panelState as new_panel when isNewPanel is true and panel is not unconfigured', async () => {
    const mockOnChange = jest.fn();
    const existingPanel = { type: 'timeseries' } as PanelModel;
    const dataWithSeries: PanelData = {
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

    render(
      <VisualizationSuggestions
        onChange={mockOnChange}
        data={dataWithSeries}
        panel={existingPanel}
        searchQuery=""
        isNewPanel={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-card-test-hash')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('suggestion-card-test-hash'));

    expect(VizSuggestionsInteractions.suggestionAccepted).toHaveBeenCalledWith(
      expect.objectContaining({ panelState: PANEL_STATES.NEW_PANEL })
    );
  });

  describe('no-data panel list', () => {
    const emptyData: PanelData = {
      series: [],
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
    };

    async function waitForSuggestionsToLoad() {
      await waitFor(() => {
        expect(mockGetAllSuggestions).toHaveBeenCalled();
      });
    }

    it('should show panels without data when there is no data', async () => {
      render(<VisualizationSuggestions onChange={jest.fn()} data={emptyData} panel={undefined} searchQuery="" />);

      await waitForSuggestionsToLoad();

      await waitFor(() => {
        expect(screen.getByText('Run a query to start seeing suggested visualizations')).toBeInTheDocument();
      });

      expect(screen.getByText('OR')).toBeInTheDocument();
      expect(screen.getByText('Start without data')).toBeInTheDocument();
      expect(screen.getByText('Text')).toBeInTheDocument();
      expect(screen.getByText('Dashboard list')).toBeInTheDocument();
      expect(screen.getByText('Alert list')).toBeInTheDocument();
    });

    it('should not show panels without data when data has series', async () => {
      const dataWithSeries: PanelData = {
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

      render(<VisualizationSuggestions onChange={jest.fn()} data={dataWithSeries} panel={undefined} searchQuery="" />);

      await waitForSuggestionsToLoad();

      await waitFor(() => {
        expect(screen.getByTestId('suggestion-card-test-hash')).toBeInTheDocument();
      });

      expect(screen.queryByText('Start without data')).not.toBeInTheDocument();
    });

    it('should call onChange when a no-data panel is clicked', async () => {
      const mockOnChange = jest.fn();

      render(<VisualizationSuggestions onChange={mockOnChange} data={emptyData} panel={undefined} searchQuery="" />);

      await waitForSuggestionsToLoad();

      await waitFor(() => {
        expect(screen.getByText('Text')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Text'));

      expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'text' }));
    });

    it('should filter no-data panels by search query', async () => {
      render(<VisualizationSuggestions onChange={jest.fn()} data={emptyData} panel={undefined} searchQuery="text" />);

      await waitForSuggestionsToLoad();

      await waitFor(() => {
        expect(screen.getByText('Text')).toBeInTheDocument();
      });

      expect(screen.queryByText('Dashboard list')).not.toBeInTheDocument();
      expect(screen.queryByText('Alert list')).not.toBeInTheDocument();
    });
  });
});
