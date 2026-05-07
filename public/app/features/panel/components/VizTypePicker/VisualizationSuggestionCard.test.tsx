import { render, screen } from '@testing-library/react';

import {
  FieldType,
  LoadingState,
  type PanelData,
  type PanelPluginVisualizationSuggestion,
  getDefaultTimeRange,
  toDataFrame,
} from '@grafana/data';
import { config } from '@grafana/runtime';

import { VisualizationSuggestionCard } from './VisualizationSuggestionCard';

const mockPanelRendererProps = jest.fn();

jest.mock('../PanelRenderer', () => ({
  PanelRenderer: (props: object) => {
    mockPanelRendererProps(props);
    return <div data-testid="panel-renderer" />;
  },
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

  beforeEach(() => {
    mockPanelRendererProps.mockClear();
  });

  afterEach(() => {
    config.featureToggles.newVizSuggestions = true;
  });

  it('should render a panel renderer card when no imgSrc is provided', () => {
    render(<VisualizationSuggestionCard data={mockData} suggestion={baseSuggestion} width={100} />);

    expect(screen.getByLabelText('Time series')).toBeInTheDocument();
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

    expect(screen.getByLabelText('Time series')).toBeInTheDocument();
  });

  it('should render successfully when isSelected is true', () => {
    render(<VisualizationSuggestionCard data={mockData} suggestion={baseSuggestion} width={100} isSelected={true} />);

    const button = screen.getByLabelText('Time series');
    expect(button).toBeInTheDocument();
    expect(button).toBeVisible();
  });

  it('should render successfully when isSelected is omitted', () => {
    const { container: withoutProp } = render(
      <VisualizationSuggestionCard data={mockData} suggestion={baseSuggestion} width={100} />
    );
    const { container: withFalseProp } = render(
      <VisualizationSuggestionCard data={mockData} suggestion={baseSuggestion} width={100} isSelected={false} />
    );

    expect(withoutProp.innerHTML).toBe(withFalseProp.innerHTML);
  });

  describe('maxSeries series-slicing', () => {
    let originalPanelSeriesLimit: number;
    beforeEach(() => {
      originalPanelSeriesLimit = config.panelSeriesLimit;
    });

    afterEach(() => {
      config.panelSeriesLimit = originalPanelSeriesLimit;
    });

    const twoSeriesData: PanelData = {
      series: [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2] },
            { name: 'a', type: FieldType.number, values: [1, 2] },
          ],
        }),
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2] },
            { name: 'b', type: FieldType.number, values: [3, 4] },
          ],
        }),
      ],
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
      structureRev: 1,
    };

    it('uses config.panelSeriesLimit when maxSeries is not set in cardOptions', () => {
      config.panelSeriesLimit = 1;

      render(<VisualizationSuggestionCard data={twoSeriesData} suggestion={baseSuggestion} width={100} />);
      const { data } = mockPanelRendererProps.mock.calls[0][0] as { data: PanelData };
      expect(data.series).toHaveLength(1);
    });

    it('uses cardOptions.maxSeries when it is smaller than config.panelSeriesLimit', () => {
      config.panelSeriesLimit = 5;

      const suggestion: PanelPluginVisualizationSuggestion = {
        ...baseSuggestion,
        cardOptions: { maxSeries: 1 },
      };

      render(<VisualizationSuggestionCard data={twoSeriesData} suggestion={suggestion} width={100} />);
      const { data } = mockPanelRendererProps.mock.calls[0][0] as { data: PanelData };
      expect(data.series).toHaveLength(1);
    });

    it('uses config.panelSeriesLimit when it is smaller than cardOptions.maxSeries', () => {
      config.panelSeriesLimit = 1;

      const suggestion: PanelPluginVisualizationSuggestion = {
        ...baseSuggestion,
        cardOptions: { maxSeries: 5 },
      };

      render(<VisualizationSuggestionCard data={twoSeriesData} suggestion={suggestion} width={100} />);
      const { data } = mockPanelRendererProps.mock.calls[0][0] as { data: PanelData };
      expect(data.series).toHaveLength(1);
    });

    it('does not slice when neither cardOptions.maxSeries nor config.panelSeriesLimit is set', () => {
      // when this number is 0, that actually means no limit
      config.panelSeriesLimit = 0;

      render(<VisualizationSuggestionCard data={twoSeriesData} suggestion={baseSuggestion} width={100} />);
      const { data } = mockPanelRendererProps.mock.calls[0][0] as { data: PanelData };
      expect(data.series).toHaveLength(2);
    });
  });
});
