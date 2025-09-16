import { useMemo } from 'react';

import { AnnotationEvent, DataFrame, DataTopic, Labels, LoadingState, arrayToDataFrame } from '@grafana/data';
import { SceneDataNode, VizConfigBuilders } from '@grafana/scenes';
import { VizPanel, useDataTransformer, useQueryRunner, useTimeRange } from '@grafana/scenes-react';
import { GraphDrawStyle, LegendDisplayMode, TooltipDisplayMode, VisibilityMode } from '@grafana/schema';
import { Box } from '@grafana/ui';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { getThresholdsForQueries } from '../../components/rule-editor/util';
import { LogRecord } from '../../components/rules/state-history/common';

interface QueryVisualizationProps {
  query: AlertQuery;
  instanceLabels: Labels;
  thresholds?: ReturnType<typeof getThresholdsForQueries>;
  recentTransitions?: LogRecord[];
}

export function QueryVisualization({
  query,
  instanceLabels,
  thresholds,
  recentTransitions = [],
}: QueryVisualizationProps) {
  const [timeRange] = useTimeRange();
  // Convert query to range query for visualization
  const visualizationQuery = useMemo(() => {
    const model = { ...query.model, refId: query.refId };

    // For Prometheus queries, ensure we use range queries for better visualization
    if ('instant' in model) {
      model.instant = false;
      model.range = true;
    }

    return model;
  }, [query.model, query.refId]);

  // Create the base data provider
  const baseDataProvider = useQueryRunner({
    datasource: { uid: query.datasourceUid },
    queries: [visualizationQuery],
  });

  // Create transformations to convert labels to fields, then filter by instance labels
  const transformations = useMemo(() => {
    const filters = Object.entries(instanceLabels).map(([labelName, labelValue]) => ({
      fieldName: labelName,
      config: {
        id: 'equal',
        options: { value: labelValue },
      },
    }));

    return [
      {
        id: 'labelsToFields',
        options: {},
      },
      {
        id: 'filterByValue',
        options: { filters, type: 'include', match: 'all' },
      },
    ];
  }, [instanceLabels]);

  // Apply transformation to filter data
  const filteredDataProvider = useDataTransformer({
    data: baseDataProvider,
    transformations,
  });

  const annotationsData = useMemo(() => {
    return recentTransitions.length > 0 ? [createAnnotationsDataFrame(recentTransitions)] : [];
  }, [recentTransitions]);

  // Get the data from the data provider
  const { data } = filteredDataProvider.useState();

  const dataProvider = new SceneDataNode({
    data: {
      series: data?.series || [],
      state: data?.state || LoadingState.NotStarted,
      timeRange: timeRange,
      annotations: annotationsData,
    },
  });

  // Create visualization config with thresholds if available
  const vizConfig = useMemo(() => {
    const baseConfig = VizConfigBuilders.timeseries()
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setCustomFieldConfig('showPoints', VisibilityMode.Auto)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setOption('legend', { showLegend: false, displayMode: LegendDisplayMode.Hidden });

    // Apply thresholds if available for this query
    const queryThresholds = thresholds?.[query.refId];
    if (queryThresholds) {
      baseConfig
        .setThresholds(queryThresholds.config)
        .setCustomFieldConfig('thresholdsStyle', { mode: queryThresholds.mode });
    }

    return baseConfig.build();
  }, [query.refId, thresholds]);

  return (
    <Box key={query.refId} height={36}>
      <VizPanel
        title={query.refId}
        viz={vizConfig}
        dataProvider={dataProvider}
        displayMode="transparent"
        collapsible={false}
      />
    </Box>
  );
}

// Function to get color based on alert state - matching EventState component colors
function getStateColor(state: string): string {
  const stateStr = String(state).toLowerCase();
  if (stateStr.includes('normal')) {
    return '#73BF69'; // Green
  } else if (stateStr.includes('alerting')) {
    return '#F2495C'; // Red
  } else if (stateStr.includes('pending')) {
    return '#FF9830'; // Orange
  } else if (stateStr.includes('recovering')) {
    return '#FF9830'; // Orange
  } else if (stateStr.includes('nodata')) {
    return '#5794F2'; // Blue
  }
  return '#8e8e8e'; // Gray for unknown states
}

// Transform state history into annotation DataFrame
function createAnnotationsDataFrame(historyRecords: LogRecord[]): DataFrame {
  const annotationEvents: AnnotationEvent[] = historyRecords.map((record) => ({
    time: record.timestamp,
    title: `${record.line.previous} → ${record.line.current}`,
    text: `State changed from ${record.line.previous} to ${record.line.current}`,
    tags: ['state-transition'],
    color: getStateColor(record.line.current),
  }));

  const annotationFrame = arrayToDataFrame(annotationEvents);
  annotationFrame.meta = {
    dataTopic: DataTopic.Annotations,
  };

  return annotationFrame;
}
