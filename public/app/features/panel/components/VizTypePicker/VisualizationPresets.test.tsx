import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LoadingState, PanelData, toDataFrame, FieldType, getDefaultTimeRange } from '@grafana/data';

import { VisualizationPresets } from './VisualizationPresets';

jest.mock('./VisualizationCardGrid', () => ({
  VisualizationCardGrid: () => <div data-testid="card-grid">Mocked Card Grid</div>,
}));

describe('VisualizationPresets', () => {
  const mockPresets = [
    {
      name: 'Default',
      description: 'Current panel style',
      options: {},
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
    },
    {
      name: 'Test preset',
      description: 'Test preset',
      options: {},
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
    },
  ];

  const mockSuggestion = {
    pluginId: 'timeseries',
    name: 'Time series',
    hash: 'timeseries-hash',
    options: {},
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
  };

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

  it('should render header with back button and skip button', () => {
    const mockOnBack = jest.fn();
    const mockOnSkip = jest.fn();

    render(
      <VisualizationPresets
        presets={mockPresets}
        data={mockData}
        suggestion={mockSuggestion}
        onPreview={jest.fn()}
        onApply={jest.fn()}
        onSkip={mockOnSkip}
        onBack={mockOnBack}
      />
    );

    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
  });

  it('should call onBack when back button is clicked', async () => {
    const mockOnBack = jest.fn();
    const user = userEvent.setup();

    render(
      <VisualizationPresets
        presets={mockPresets}
        data={mockData}
        suggestion={mockSuggestion}
        onPreview={jest.fn()}
        onApply={jest.fn()}
        onSkip={jest.fn()}
        onBack={mockOnBack}
      />
    );

    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('should call onSkip when skip button is clicked', async () => {
    const mockOnSkip = jest.fn();
    const user = userEvent.setup();

    render(
      <VisualizationPresets
        presets={mockPresets}
        data={mockData}
        suggestion={mockSuggestion}
        onPreview={jest.fn()}
        onApply={jest.fn()}
        onSkip={mockOnSkip}
        onBack={jest.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /skip/i }));
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
  });

  it('should render card grid with presets', () => {
    render(
      <VisualizationPresets
        presets={mockPresets}
        data={mockData}
        suggestion={mockSuggestion}
        onPreview={jest.fn()}
        onApply={jest.fn()}
        onSkip={jest.fn()}
        onBack={jest.fn()}
      />
    );

    expect(screen.getByTestId('card-grid')).toBeInTheDocument();
  });
});
