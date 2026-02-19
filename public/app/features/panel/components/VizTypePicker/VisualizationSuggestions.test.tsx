import { render, waitFor } from '@testing-library/react';

import { LoadingState, PanelData, toDataFrame, FieldType, getDefaultTimeRange } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { UNCONFIGURED_PANEL_PLUGIN_ID } from 'app/features/dashboard-scene/scene/UnconfiguredPanel';

import * as getAllSuggestionsModule from '../../suggestions/getAllSuggestions';

import { VisualizationSuggestions } from './VisualizationSuggestions';

jest.mock('../../suggestions/getAllSuggestions');
jest.mock('./VisualizationSuggestionCard', () => ({
  VisualizationSuggestionCard: () => <div data-testid="suggestion-card">Mocked Card</div>,
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
        vizPanel={undefined}
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
        vizPanel={undefined}
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
        vizPanel={undefined}
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
        vizPanel={undefined}
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
    const unconfiguredPanel = { state: { pluginId: UNCONFIGURED_PANEL_PLUGIN_ID } } as VizPanel;
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
      <VisualizationSuggestions onChange={mockOnChange} data={data} vizPanel={unconfiguredPanel} isNewPanel={true} />
    );

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  it('should not call onChange for existing panels', async () => {
    const mockOnChange = jest.fn();
    const existingPanel = { state: { pluginId: 'timeseries' } } as VizPanel;
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
      <VisualizationSuggestions onChange={mockOnChange} data={data} vizPanel={existingPanel} isNewPanel={false} />
    );

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
    const unconfiguredPanel = { state: { pluginId: UNCONFIGURED_PANEL_PLUGIN_ID } } as VizPanel;
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
      <VisualizationSuggestions onChange={mockOnChange} data={data} vizPanel={unconfiguredPanel} isNewPanel={false} />
    );

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
    });
  });
});
