import { useMemo } from 'react';

import { DataFrame, Labels, LoadingState } from '@grafana/data';
import { SceneDataNode, VizConfigBuilders } from '@grafana/scenes';
import { VizPanel, useDataTransformer, useQueryRunner, useTimeRange } from '@grafana/scenes-react';
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

  // Get the data from the data provider
  const { data } = filteredDataProvider.useState();

  const dataProvider = new SceneDataNode({
    data: {
      series: data?.series || [],
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
