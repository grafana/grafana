import { type performanceUtils } from '@grafana/scenes';

import { ScenePerformanceLogger } from './ScenePerformanceLogger';
import { observePerformanceEntries, setupNodePerformance } from './performanceTestUtils';

function runDashboardRefresh(logger: ScenePerformanceLogger, index: number): void {
  const operationId = `refresh-${index}`;
  const timestamp = index * 10;

  logger.onDashboardInteractionStart({
    interactionType: 'refresh',
    operationId,
    timestamp,
  } as performanceUtils.DashboardInteractionStartData);
  logger.onDashboardInteractionMilestone({
    operationId: `milestone-${operationId}`,
    milestone: 'queries-started',
    timestamp: timestamp + 1,
  } as performanceUtils.DashboardInteractionMilestoneData);
  logger.onPanelOperationStart({
    panelId: '1',
    panelKey: 'panel-1',
    pluginId: 'timeseries',
    operation: 'render',
    operationId,
    timestamp: timestamp + 2,
    metadata: {},
  } as performanceUtils.PanelPerformanceData);
  logger.onPanelOperationComplete({
    panelId: '1',
    panelKey: 'panel-1',
    pluginId: 'timeseries',
    operation: 'render',
    operationId,
    timestamp: timestamp + 3,
    duration: 1,
    metadata: {},
  } as performanceUtils.PanelPerformanceData);
  logger.onPanelOperationStart({
    panelId: '2',
    panelKey: 'panel-2',
    pluginId: 'timeseries',
    operation: 'render',
    operationId: `cancelled-${operationId}`,
    timestamp: timestamp + 4,
    metadata: {},
  } as performanceUtils.PanelPerformanceData);
  logger.onDashboardInteractionComplete({
    interactionType: 'refresh',
    operationId,
    timestamp: timestamp + 5,
    duration: 5,
    networkDuration: 0,
    longFramesCount: 0,
    longFramesTotalTime: 0,
  } as performanceUtils.DashboardInteractionCompleteData);
}

describe('ScenePerformanceLogger', () => {
  setupNodePerformance();

  it('does not retain owned entries across dashboard refreshes', () => {
    const logger = new ScenePerformanceLogger();
    performance.mark('unrelated-start');
    performance.mark('unrelated-end');
    performance.measure('unrelated-measure', 'unrelated-start', 'unrelated-end');

    for (let index = 0; index < 100; index++) {
      runDashboardRefresh(logger, index);
    }

    expect(performance.getEntriesByType('mark').filter(({ name }) => name.startsWith('scenes.'))).toHaveLength(0);
    expect(performance.getEntriesByType('measure').filter(({ name }) => name.startsWith('scenes.'))).toHaveLength(0);
    expect(performance.getEntriesByName('unrelated-start', 'mark')).toHaveLength(1);
    expect(performance.getEntriesByName('unrelated-end', 'mark')).toHaveLength(1);
    expect(performance.getEntriesByName('unrelated-measure', 'measure')).toHaveLength(1);
  });

  it('publishes late completions without fabricating missing durations', async () => {
    const logger = new ScenePerformanceLogger();
    const observedEntries = observePerformanceEntries();
    const operation = {
      panelId: '1',
      panelKey: 'panel-1',
      pluginId: 'timeseries',
      operation: 'render',
      operationId: 'late-render',
      timestamp: 1,
      metadata: {},
    } as performanceUtils.PanelPerformanceData;

    logger.onDashboardInteractionStart({
      interactionType: 'refresh',
      operationId: 'refresh',
      timestamp: 0,
    } as performanceUtils.DashboardInteractionStartData);
    logger.onDashboardInteractionMilestone({
      interactionType: 'refresh',
      operationId: 'milestone-refresh',
      milestone: 'queries-started',
      timestamp: 0.5,
    } as performanceUtils.DashboardInteractionMilestoneData);
    logger.onPanelOperationStart(operation);
    logger.onDashboardInteractionComplete({
      interactionType: 'refresh',
      operationId: 'refresh',
      timestamp: 2,
      networkDuration: 0,
      longFramesCount: 0,
      longFramesTotalTime: 0,
    } as performanceUtils.DashboardInteractionCompleteData);

    logger.onDashboardInteractionStart({
      interactionType: 'refresh',
      operationId: 'overlapping-refresh',
      timestamp: 2.5,
    } as performanceUtils.DashboardInteractionStartData);

    expect(performance.getEntriesByName('scenes.panel.render.start.panel-1.late-render', 'mark')).toHaveLength(0);

    logger.onPanelOperationComplete({ ...operation, timestamp: 3, duration: 2 });

    expect(performance.getEntriesByName('scenes.panel.render.start.panel-1.late-render', 'mark')).toHaveLength(0);
    expect(performance.getEntriesByName('scenes.panel.render.duration.panel-1.late-render', 'measure')).toHaveLength(0);
    const entries = await observedEntries;
    expect(entries).toEqual(
      expect.arrayContaining([
        {
          name: 'scenes.dashboard.interaction.start.refresh',
          startTime: 0,
          duration: 0,
        },
        {
          name: 'scenes.dashboard.milestone.queries-started.milestone-refresh',
          startTime: 0.5,
          duration: 0,
        },
        {
          name: 'scenes.panel.render.start.panel-1.late-render',
          startTime: 1,
          duration: 0,
        },
        {
          name: 'scenes.panel.render.end.panel-1.late-render',
          startTime: 3,
          duration: 0,
        },
        {
          name: 'scenes.panel.render.duration.panel-1.late-render',
          startTime: 1,
          duration: 2,
        },
      ])
    );
    expect(entries.map(({ name }) => name)).not.toContain('scenes.dashboard.interaction.duration.refresh');
  });
});
