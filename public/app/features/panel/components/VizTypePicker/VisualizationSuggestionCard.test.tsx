import { render, screen, waitFor } from '@testing-library/react';
import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import {
  type DataFrame,
  FieldType,
  type InterpolateFunction,
  LoadingState,
  type PanelData,
  type PanelPluginVisualizationSuggestion,
  getDefaultTimeRange,
  toDataFrame,
} from '@grafana/data';
import { mergeTransformer, mockTransformationsRegistry } from '@grafana/data/internal';
import { config, setTemplateSrv } from '@grafana/runtime';

import { VisualizationSuggestionCard } from './VisualizationSuggestionCard';

const mockPanelRendererProps = jest.fn();

jest.mock('../PanelRenderer', () => ({
  PanelRenderer: (props: object) => {
    mockPanelRendererProps(props);
    return <div data-testid="panel-renderer" />;
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

  it('previews with an interpolator that resolves scoped variables and data macros', () => {
    setTemplateSrv(initTemplateSrv('suggestion-card', []));
    const [frame] = mockData.series;

    render(<VisualizationSuggestionCard data={mockData} suggestion={baseSuggestion} width={100} />);
    const { replaceVariables } = mockPanelRendererProps.mock.calls[0][0] as { replaceVariables: InterpolateFunction };

    expect(
      replaceVariables('${reduced} of ${__field.name}', {
        reduced: { text: '75.0%', value: '75.0%' },
        __dataContext: { value: { data: mockData.series, frame, field: frame.fields[1], frameIndex: 0 } },
      })
    ).toBe('75.0% of value');
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

  describe('with transformations', () => {
    const merged: PanelPluginVisualizationSuggestion = {
      ...baseSuggestion,
      transformations: [{ id: 'merge', options: {} }],
    };

    function series(a: number, b: number): DataFrame[] {
      return [
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1] },
            { name: 'a', type: FieldType.number, values: [a] },
          ],
        }),
        toDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1] },
            { name: 'b', type: FieldType.number, values: [b] },
          ],
        }),
      ];
    }

    function panelData(frames: DataFrame[]): PanelData {
      return { series: frames, state: LoadingState.Done, timeRange: getDefaultTimeRange() };
    }

    function lastPreviewSeries() {
      return (mockPanelRendererProps.mock.lastCall?.[0] as { data: PanelData }).data.series;
    }

    function fieldValues(frames: DataFrame[]) {
      return frames.map((frame) => frame.fields.map((field) => [field.name, ...field.values]));
    }

    beforeAll(() => {
      mockTransformationsRegistry([mergeTransformer]);
      setTemplateSrv(initTemplateSrv('suggestion-card-transformations', []));
    });

    it('previews what the transformations produce, and never the raw frames', async () => {
      render(<VisualizationSuggestionCard data={panelData(series(1, 2))} suggestion={merged} width={100} />);

      expect(screen.getByLabelText('Time series')).toBeInTheDocument();
      expect(screen.queryByTestId('panel-renderer')).not.toBeInTheDocument();
      expect(await screen.findByTestId('panel-renderer')).toBeInTheDocument();

      expect(mockPanelRendererProps.mock.calls.every(([{ data }]) => data.series.length === 1)).toBe(true);
      expect(fieldValues(lastPreviewSeries())).toEqual([
        [
          ['time', 1],
          ['a', 1],
          ['b', 2],
        ],
      ]);
    });

    it('previews the transformed new data when the query results change', async () => {
      const { rerender } = render(
        <VisualizationSuggestionCard data={panelData(series(1, 2))} suggestion={merged} width={100} />
      );
      await screen.findByTestId('panel-renderer');

      rerender(<VisualizationSuggestionCard data={panelData(series(3, 4))} suggestion={merged} width={100} />);

      await waitFor(() =>
        expect(fieldValues(lastPreviewSeries())).toEqual([
          [
            ['time', 1],
            ['a', 3],
            ['b', 4],
          ],
        ])
      );
    });

    it('runs the transformations over every frame before applying the preview limit', async () => {
      const originalPanelSeriesLimit = config.panelSeriesLimit;
      config.panelSeriesLimit = 1;

      render(<VisualizationSuggestionCard data={panelData(series(1, 2))} suggestion={merged} width={100} />);
      await screen.findByTestId('panel-renderer');

      expect(lastPreviewSeries()[0].fields.map(({ name }) => name)).toEqual(['time', 'a', 'b']);

      config.panelSeriesLimit = originalPanelSeriesLimit;
    });

    it('hands over the data untouched without transformations', () => {
      const data = panelData(series(1, 2));
      const originalPanelSeriesLimit = config.panelSeriesLimit;
      config.panelSeriesLimit = 0;

      render(<VisualizationSuggestionCard data={data} suggestion={baseSuggestion} width={100} />);

      expect((mockPanelRendererProps.mock.lastCall?.[0] as { data: PanelData }).data).toBe(data);

      config.panelSeriesLimit = originalPanelSeriesLimit;
    });
  });
});
