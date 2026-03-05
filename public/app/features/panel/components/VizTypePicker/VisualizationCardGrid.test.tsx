import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  FieldType,
  LoadingState,
  PanelData,
  PanelPluginVisualizationSuggestion,
  getDefaultTimeRange,
  toDataFrame,
} from '@grafana/data';

import { VisualizationCardGrid, VisualizationCardGridGroup } from './VisualizationCardGrid';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    featureToggles: { newVizSuggestions: true },
  },
}));

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
  const onItemClick = jest.fn();

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

  const mockItem: PanelPluginVisualizationSuggestion[] = [
    { pluginId: 'timeseries', name: 'Time series', hash: 'ts-hash', options: {} },
    { pluginId: 'table', name: 'Table', hash: 'table-hash', options: {} },
  ];

  beforeEach(() => {
    onItemClick.mockClear();
  });

  describe('flat items', () => {
    it('should render all items', () => {
      render(
        <VisualizationCardGrid
          items={mockItem}
          data={mockData}
          onItemClick={onItemClick}
          getItemKey={(item) => item.hash}
        />
      );

      expect(screen.getByTestId('card-ts-hash')).toBeInTheDocument();
      expect(screen.getByTestId('card-table-hash')).toBeInTheDocument();
    });

    it('should call onItemClick when a card is clicked', async () => {
      const user = userEvent.setup();
      render(
        <VisualizationCardGrid
          items={mockItem}
          data={mockData}
          onItemClick={onItemClick}
          getItemKey={(item) => item.hash}
        />
      );

      await user.click(screen.getByTestId('card-ts-hash'));

      expect(onItemClick).toHaveBeenCalledWith(mockItem[0], 0);
    });

    it('should call onItemClick when Enter key is pressed on a card', () => {
      render(
        <VisualizationCardGrid
          items={mockItem}
          data={mockData}
          onItemClick={onItemClick}
          getItemKey={(item) => item.hash}
        />
      );

      const card = screen.getByTestId('card-ts-hash').closest('[role="button"]')!;
      fireEvent.keyDown(card, { key: 'Enter' });

      expect(onItemClick).toHaveBeenCalledWith(mockItem[0], 0);
    });

    it('should call onItemClick when Space key is pressed on a card', () => {
      render(
        <VisualizationCardGrid
          items={mockItem}
          data={mockData}
          onItemClick={onItemClick}
          getItemKey={(item) => item.hash}
        />
      );

      const card = screen.getByTestId('card-ts-hash').closest('[role="button"]')!;
      fireEvent.keyDown(card, { key: ' ' });

      expect(onItemClick).toHaveBeenCalledWith(mockItem[0], 0);
    });

    it('should not call onChange when an unrelated key is pressed on a card', async () => {
      render(
        <VisualizationCardGrid
          items={mockItem}
          data={mockData}
          onItemClick={onItemClick}
          getItemKey={(item) => item.hash}
        />
      );

      const card = screen.getByTestId('card-ts-hash').closest('[role="button"]')!;
      fireEvent.keyDown(card, { key: 'ArrowDown' });

      expect(onItemClick).not.toHaveBeenCalled();
    });
  });

  describe('grouped items', () => {
    const groups: VisualizationCardGridGroup[] = [
      {
        meta: { id: 'timeseries', name: 'Time series', sort: 0, hideFromList: false } as never,
        items: [mockItem[0]],
      },
      {
        meta: { id: 'table', name: 'Table', sort: 1, hideFromList: false } as never,
        items: [mockItem[1]],
      },
    ];

    it('should render group headers and cards', () => {
      render(
        <VisualizationCardGrid
          groups={groups}
          data={mockData}
          onItemClick={onItemClick}
          getItemKey={(item) => item.hash}
        />
      );

      expect(screen.getByTestId('card-ts-hash')).toBeInTheDocument();
      expect(screen.getByTestId('card-table-hash')).toBeInTheDocument();
    });

    it('should call onItemClick with correct index when a card is clicked', async () => {
      const user = userEvent.setup();
      render(
        <VisualizationCardGrid
          groups={groups}
          data={mockData}
          onItemClick={onItemClick}
          getItemKey={(item) => item.hash}
        />
      );

      await user.click(screen.getByTestId('card-table-hash'));

      expect(onItemClick).toHaveBeenCalledWith(mockItem[1], 1);
    });

    it('should render unknown viz type header when group meta is undefined', () => {
      render(
        <VisualizationCardGrid
          groups={[{ meta: undefined, items: [mockItem[0]] }]}
          data={mockData}
          onItemClick={onItemClick}
          getItemKey={(item) => item.hash}
        />
      );

      expect(screen.getByText('Unknown visualization type')).toBeInTheDocument();
    });
  });
});
