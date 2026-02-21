import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  LoadingState,
  PanelData,
  PanelPluginVisualizationSuggestion,
  toDataFrame,
  FieldType,
  getDefaultTimeRange,
} from '@grafana/data';

import { VisualizationCardGrid } from './VisualizationCardGrid';

jest.mock('./VisualizationSuggestionCard', () => ({
  VisualizationSuggestionCard: ({
    onClick,
    suggestion,
  }: {
    onClick: () => void;
    suggestion: PanelPluginVisualizationSuggestion;
  }) => (
    <div data-testid={`card-${suggestion.hash}`} onClick={onClick}>
      {suggestion.name}
    </div>
  ),
}));

describe('VisualizationCardGrid', () => {
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

  const mockItems = [
    {
      pluginId: 'timeseries',
      name: 'Time series',
      hash: 'timeseries-hash',
      options: {},
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
    },
    {
      pluginId: 'table',
      name: 'Table',
      hash: 'table-hash',
      options: {},
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
    },
  ];

  it('should render cards for items', () => {
    render(
      <VisualizationCardGrid
        items={mockItems}
        data={mockData}
        selectedItemKey={null}
        onItemClick={jest.fn()}
        onItemApply={jest.fn()}
        getItemKey={(item) => item.hash}
        buttonLabel="Apply"
        getButtonAriaLabel={(item) => `Apply ${item.name}`}
      />
    );

    expect(screen.getByTestId('card-timeseries-hash')).toBeInTheDocument();
    expect(screen.getByTestId('card-table-hash')).toBeInTheDocument();
  });

  it('should call onItemClick when card is clicked', async () => {
    const mockOnItemClick = jest.fn();
    const user = userEvent.setup();

    render(
      <VisualizationCardGrid
        items={mockItems}
        data={mockData}
        selectedItemKey={null}
        onItemClick={mockOnItemClick}
        onItemApply={jest.fn()}
        getItemKey={(item) => item.hash}
        buttonLabel="Apply"
        getButtonAriaLabel={(item) => `Apply ${item.name}`}
      />
    );

    await user.click(screen.getByTestId('card-timeseries-hash'));
    expect(mockOnItemClick).toHaveBeenCalledWith(mockItems[0], 0);
  });

  it('should show primary button when card is selected', () => {
    render(
      <VisualizationCardGrid
        items={mockItems}
        data={mockData}
        selectedItemKey="timeseries-hash"
        onItemClick={jest.fn()}
        onItemApply={jest.fn()}
        getItemKey={(item) => item.hash}
        buttonLabel="Apply"
        getButtonAriaLabel={(item) => `Apply ${item.name}`}
      />
    );

    expect(screen.getByTestId('data-testid suggestion-Time series confirm button')).toBeInTheDocument();
    expect(screen.getByText('Apply')).toBeInTheDocument();
  });

  it('should call onItemApply when primary button is clicked', async () => {
    const mockOnItemApply = jest.fn();
    const user = userEvent.setup();

    render(
      <VisualizationCardGrid
        items={mockItems}
        data={mockData}
        selectedItemKey="timeseries-hash"
        onItemClick={jest.fn()}
        onItemApply={mockOnItemApply}
        getItemKey={(item) => item.hash}
        buttonLabel="Apply"
        getButtonAriaLabel={(item) => `Apply ${item.name}`}
      />
    );

    await user.click(screen.getByTestId('data-testid suggestion-Time series confirm button'));
    expect(mockOnItemApply).toHaveBeenCalledWith(mockItems[0], 0);
  });

  it('should show secondary button when provided and shouldShow returns true', () => {
    const mockSecondaryButton = {
      onAction: jest.fn(),
      label: 'Configure',
      getAriaLabel: (item: PanelPluginVisualizationSuggestion) => `Configure ${item.name}`,
      shouldShow: () => true,
    };

    render(
      <VisualizationCardGrid
        items={mockItems}
        data={mockData}
        selectedItemKey="timeseries-hash"
        onItemClick={jest.fn()}
        onItemApply={jest.fn()}
        getItemKey={(item) => item.hash}
        buttonLabel="Apply"
        getButtonAriaLabel={(item) => `Apply ${item.name}`}
        secondaryButton={mockSecondaryButton}
      />
    );

    expect(screen.getByText('Configure')).toBeInTheDocument();
  });

  it('should not show secondary button when shouldShow returns false', () => {
    const mockSecondaryButton = {
      onAction: jest.fn(),
      label: 'Configure',
      getAriaLabel: (item: PanelPluginVisualizationSuggestion) => `Configure ${item.name}`,
      shouldShow: () => false,
    };

    render(
      <VisualizationCardGrid
        items={mockItems}
        data={mockData}
        selectedItemKey="timeseries-hash"
        onItemClick={jest.fn()}
        onItemApply={jest.fn()}
        getItemKey={(item) => item.hash}
        buttonLabel="Apply"
        getButtonAriaLabel={(item) => `Apply ${item.name}`}
        secondaryButton={mockSecondaryButton}
      />
    );

    expect(screen.queryByText('Configure')).not.toBeInTheDocument();
    expect(screen.getByText('Apply')).toBeInTheDocument();
  });

  it('should call secondaryButton.onAction when secondary button is clicked', async () => {
    const mockOnAction = jest.fn();
    const mockSecondaryButton = {
      onAction: mockOnAction,
      label: 'Configure',
      getAriaLabel: (item: PanelPluginVisualizationSuggestion) => `Configure ${item.name}`,
      shouldShow: () => true,
    };
    const user = userEvent.setup();

    render(
      <VisualizationCardGrid
        items={mockItems}
        data={mockData}
        selectedItemKey="timeseries-hash"
        onItemClick={jest.fn()}
        onItemApply={jest.fn()}
        getItemKey={(item) => item.hash}
        buttonLabel="Apply"
        getButtonAriaLabel={(item) => `Apply ${item.name}`}
        secondaryButton={mockSecondaryButton}
      />
    );

    await user.click(screen.getByText('Configure'));
    expect(mockOnAction).toHaveBeenCalledWith(mockItems[0], 0);
  });
});
