import { useMemo } from 'react';

import { DataFrame, Labels, LoadingState } from '@grafana/data';
import { SceneDataNode, VizConfigBuilders } from '@grafana/scenes';
import { VizPanel, useQueryRunner, useTimeRange } from '@grafana/scenes-react';
import { GraphDrawStyle, LegendDisplayMode, TooltipDisplayMode, VisibilityMode } from '@grafana/schema';
import { Box } from '@grafana/ui';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { getThresholdsForQueries } from '../../components/rule-editor/util';

interface QueryVisualizationProps {
  query: AlertQuery;
  instanceLabels: Labels;
  thresholds?: ReturnType<typeof getThresholdsForQueries>;
  annotations?: DataFrame[];
}

export function QueryVisualization({ query, instanceLabels, thresholds, annotations = [] }: QueryVisualizationProps) {
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

  // Get data and filter by instance labels
  const { data } = baseDataProvider.useState();

  // Filter frames to only include those matching the instance labels
  const filteredSeries = useMemo(() => {
    if (!data?.series || Object.keys(instanceLabels).length === 0) {
      return data?.series || [];
    }

    return data.series.filter((frame) => frameMatchesInstanceLabels(frame, instanceLabels));
  }, [data?.series, instanceLabels]);

  // Create a data provider with filtered series
  const dataProvider = new SceneDataNode({
    data: {
      series: filteredSeries,
      state: data?.state || LoadingState.NotStarted,
      timeRange: timeRange,
      annotations: annotations,
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

// Helper function to check if frame labels match instance labels
function frameMatchesInstanceLabels(frame: DataFrame, instanceLabels: Labels): boolean {
  // Check if any field in the frame has labels that are a subset of instance labels
  // (i.e., all field labels exist in instanceLabels with matching values)
  //
  // Note: We check if field.labels ⊆ instanceLabels (subset) rather than equality because
  // the alert rule evaluation engine might apply additional rule-specific labels coming from
  // rule labels and labels templating. Currently, we have no way of knowing these additional
  // labels when querying the datasource directly, so instanceLabels may contain more labels
  // than what appears in the raw query results.
  for (const field of frame.fields) {
    if (field.labels) {
      const allFieldLabelsMatch = Object.entries(field.labels).every(([key, value]) => instanceLabels[key] === value);
      if (allFieldLabelsMatch) {
        return true;
      }
    }
  }
  return false;
}
