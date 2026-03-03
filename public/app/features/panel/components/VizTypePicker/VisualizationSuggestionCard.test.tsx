import { render, screen } from '@testing-library/react';

import {
  FieldType,
  LoadingState,
  PanelData,
  PanelPluginVisualizationSuggestion,
  getDefaultTimeRange,
  toDataFrame,
} from '@grafana/data';
import { config } from '@grafana/runtime';

import { VisualizationSuggestionCard } from './VisualizationSuggestionCard';

jest.mock('../PanelRenderer', () => ({
  PanelRenderer: () => <div data-testid="panel-renderer" />,
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

describe('VisualizationSuggestionCard', () => {
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

  const baseSuggestion: PanelPluginVisualizationSuggestion = {
    pluginId: 'timeseries',
    name: 'Time series',
    hash: 'ts-hash',
    options: {},
  };

  afterEach(() => {
    config.featureToggles.newVizSuggestions = true;
  });

  it('should render a panel renderer card when no imgSrc is provided', () => {
    render(<VisualizationSuggestionCard data={mockData} suggestion={baseSuggestion} width={100} />);

    expect(screen.getByRole('button', { name: 'Time series' })).toBeInTheDocument();
    expect(screen.getByTestId('panel-renderer')).toBeInTheDocument();
  });

  it('should render an image card when imgSrc is provided', () => {
    const suggestion: PanelPluginVisualizationSuggestion = {
      ...baseSuggestion,
      cardOptions: { imgSrc: 'https://test.com/img.png' },
    };

    render(<VisualizationSuggestionCard data={mockData} suggestion={suggestion} width={100} />);

    expect(screen.getByRole('img', { name: 'Time series' })).toBeInTheDocument();
    expect(screen.queryByTestId('panel-renderer')).not.toBeInTheDocument();
  });

  it('should call previewModifier when provided in cardOptions', () => {
    const previewModifier = jest.fn();
    const suggestion: PanelPluginVisualizationSuggestion = {
      ...baseSuggestion,
      cardOptions: { previewModifier },
    };

    render(<VisualizationSuggestionCard data={mockData} suggestion={suggestion} width={200} />);

    expect(previewModifier).toHaveBeenCalled();
  });

  it('should wrap content in a Tooltip when newVizSuggestions feature flag is disabled', () => {
    config.featureToggles.newVizSuggestions = false;

    render(<VisualizationSuggestionCard data={mockData} suggestion={baseSuggestion} width={200} />);

    expect(screen.getByRole('button', { name: 'Time series' })).toBeInTheDocument();
  });
});
