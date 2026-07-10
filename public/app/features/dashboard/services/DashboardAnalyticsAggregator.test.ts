import { logMeasurement } from '@grafana/runtime';
import { type performanceUtils } from '@grafana/scenes';

import { DashboardAnalyticsAggregator } from './DashboardAnalyticsAggregator';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  logMeasurement: jest.fn(),
  reportInteraction: jest.fn(),
}));

const logMeasurementMock = jest.mocked(logMeasurement);

function panelOp(
  operation: performanceUtils.PanelPerformanceData['operation'],
  duration: number
): performanceUtils.PanelPerformanceData {
  return {
    panelId: '1',
    panelKey: 'panel-1',
    pluginId: 'timeseries',
    operation,
    metadata: {
      queryId: 'q1',
      queryType: 'range',
      transformationId: 'reduce',
      transformationCount: 1,
      seriesTransformationCount: 1,
      annotationTransformationCount: 0,
      success: true,
      pluginId: 'timeseries',
    },
    operationId: 'op-1',
    timestamp: 0,
    duration,
  } as unknown as performanceUtils.PanelPerformanceData;
}

describe('DashboardAnalyticsAggregator', () => {
  let aggregator: DashboardAnalyticsAggregator;

  beforeEach(() => {
    jest.clearAllMocks();
    // sendAnalyticsReport measures against a boot mark that is not present in tests.
    jest.spyOn(performance, 'measure').mockReturnValue({ duration: 0 } as PerformanceMeasure);
    aggregator = new DashboardAnalyticsAggregator();
    aggregator.initialize('dash-uid', 'Test dashboard');
  });

  it('reports a per-phase duration breakdown alongside total_time on the panel_render event', () => {
    aggregator.onPanelOperationStart(panelOp('query', 0));

    // Distinct, already-rounded durations so each phase lands in its own bucket.
    aggregator.onPanelOperationComplete(panelOp('query', 120.5));
    aggregator.onPanelOperationComplete(panelOp('render', 45.5));
    aggregator.onPanelOperationComplete(panelOp('transform', 30));
    aggregator.onPanelOperationComplete(panelOp('fieldConfig', 10));
    aggregator.onPanelOperationComplete(panelOp('plugin-load', 25));

    aggregator.onDashboardInteractionComplete({
      interactionType: 'dashboard_view',
      operationId: 'op-1',
      timestamp: 1000,
      duration: 250,
      networkDuration: 120.5,
      longFramesCount: 0,
      longFramesTotalTime: 0,
    });

    const panelRenderCalls = logMeasurementMock.mock.calls.filter(([event]) => event === 'panel_render');
    expect(panelRenderCalls).toHaveLength(1);

    const [, measurementValues] = panelRenderCalls[0];
    expect(measurementValues).toMatchObject({
      totalTime: 231,
      networkDuration: 120.5,
      renderDuration: 45.5,
      transformDuration: 30,
      fieldConfigDuration: 10,
      pluginLoadDuration: 25,
      queryCount: 1,
      transformCount: 1,
      renderCount: 1,
      fieldConfigCount: 1,
      pluginLoadCount: 1,
    });
  });
});
