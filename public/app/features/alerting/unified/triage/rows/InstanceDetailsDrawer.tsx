import { useMemo } from 'react';

import { Labels } from '@grafana/data';
import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { VizConfigBuilders } from '@grafana/scenes';
import { VizPanel, useDataTransformer, useQueryRunner, useTimeRange } from '@grafana/scenes-react';
import { GraphDrawStyle, LegendDisplayMode, TooltipDisplayMode, VisibilityMode } from '@grafana/schema';
import { Alert, Box, Drawer, Icon, LoadingPlaceholder, Stack, Text } from '@grafana/ui';
import { GrafanaRuleIdentifier } from 'app/types/unified-alerting';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { isExpressionQuery } from '../../../../expressions/guards';
import { stateHistoryApi } from '../../api/stateHistoryApi';
import { AlertLabels } from '../../components/AlertLabels';
import { getThresholdsForQueries } from '../../components/rule-editor/util';
import { EventState } from '../../components/rules/central-state-history/EventListSceneObject';
import { useRuleHistoryRecords } from '../../components/rules/central-state-history/useRuleHistoryRecords';
import { LogRecord } from '../../components/rules/state-history/common';
import { useCombinedRule } from '../../hooks/useCombinedRule';
import { stringifyErrorLike } from '../../utils/misc';
import { rulerRuleType } from '../../utils/rules';

interface InstanceDetailsDrawerProps {
  ruleUID: string;
  instanceLabels: Labels;
  onClose: () => void;
}

interface QueryVisualizationProps {
  query: AlertQuery;
  instanceLabels: Labels;
  thresholds?: ReturnType<typeof getThresholdsForQueries>;
}

interface StateTransitionProps {
  record: LogRecord;
}

function StateTransition({ record }: StateTransitionProps) {
  return (
    <Stack gap={1} direction="row" alignItems="center">
      <EventState state={record.line.previous} showLabel addFilter={() => {}} type="from" />
      <Icon name="arrow-right" size="sm" />
      <EventState state={record.line.current} showLabel addFilter={() => {}} type="to" />
      <Text variant="bodySmall" color="secondary">
        {new Date(record.timestamp).toLocaleString()}
      </Text>
    </Stack>
  );
}

function QueryVisualization({ query, instanceLabels, thresholds }: QueryVisualizationProps) {
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
        options: {
          value: labelValue,
        },
      },
    }));

    return [
      {
        id: 'labelsToFields',
        options: {},
      },
      {
        id: 'filterByValue',
        options: {
          filters,
          type: 'include',
          match: 'all',
        },
      },
    ];
  }, [instanceLabels]);

  // Apply transformation to filter data
  const filteredDataProvider = useDataTransformer({
    data: baseDataProvider,
    transformations,
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
        dataProvider={filteredDataProvider}
        displayMode="transparent"
        collapsible={false}
      />
    </Box>
  );
}

export function InstanceDetailsDrawer({ ruleUID, instanceLabels, onClose }: InstanceDetailsDrawerProps) {
  // Get the current time range from the scene
  const [timeRange] = useTimeRange();

  // Create rule identifier for Grafana managed rules
  const ruleIdentifier: GrafanaRuleIdentifier = useMemo(
    () => ({
      uid: ruleUID,
      ruleSourceName: 'grafana',
    }),
    [ruleUID]
  );

  // Fetch rule data to get alert instances
  const {
    loading,
    error,
    result: rule,
  } = useCombinedRule({
    ruleIdentifier,
  });

  // Extract and filter data queries (non-expression queries)
  const dataQueries = useMemo(() => {
    if (!rule?.rulerRule || !('grafana_alert' in rule.rulerRule) || !rule.rulerRule.grafana_alert.data) {
      return [];
    }

    return rule.rulerRule.grafana_alert.data.filter((query: AlertQuery) => !isExpressionQuery(query.model));
  }, [rule]);

  // Extract threshold definitions from expression queries
  const thresholds = useMemo(() => {
    const rulerRule = rule?.rulerRule;
    const grafanaRule = rulerRuleType.grafana.rule(rulerRule) ? rulerRule : undefined;
    if (!grafanaRule) {
      return {};
    }

    const allQueries = grafanaRule.grafana_alert.data;
    const condition = grafanaRule.grafana_alert.condition;

    return getThresholdsForQueries(allQueries, condition);
  }, [rule]);

  // Fetch state history for this specific instance
  const {
    data: stateHistoryData,
    isLoading: stateHistoryLoading,
    isError: stateHistoryError,
  } = stateHistoryApi.endpoints.getRuleHistory.useQuery({
    ruleUid: ruleUID,
    labels: instanceLabels,
    limit: 10,
    from: timeRange.from.unix(),
    to: timeRange.to.unix(),
  });

  // Process state history data into LogRecords
  const { historyRecords } = useRuleHistoryRecords(stateHistoryData, {
    labels: Object.entries(instanceLabels)
      .map(([key, value]) => `${key}=${value}`)
      .join(','),
  });

  // Sort by timestamp (most recent first) and limit to recent entries
  const recentTransitions = historyRecords.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

  if (error) {
    return (
      <Drawer title={t('alerting.triage.instance-details', 'Instance Details')} onClose={onClose} size="md">
        <ErrorContent error={error} />
      </Drawer>
    );
  }

  if (loading || !rule) {
    return (
      <Drawer title={t('alerting.triage.instance-details', 'Instance Details')} onClose={onClose} size="md">
        <div>{t('alerting.common.loading', 'Loading...')}</div>
      </Drawer>
    );
  }

  return (
    <Drawer
      title={t('alerting.instance-details-drawer.title-instance-details', 'Instance Details')}
      onClose={onClose}
      size="lg"
    >
      <Stack direction="column" gap={3}>
        {/* Instance Labels */}
        <Box>
          <AlertLabels labels={instanceLabels} />
        </Box>

        {/* Query Visualizations */}
        {dataQueries.length > 0 && (
          <Box>
            <Stack direction="column" gap={2}>
              {dataQueries.map((query, index) => (
                <QueryVisualization
                  key={query.refId || `query-${index}`}
                  query={query}
                  instanceLabels={instanceLabels}
                  thresholds={thresholds}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* State History */}
        <Box>
          <Text variant="h6">{t('alerting.instance-details.state-history', 'Recent State Changes')}</Text>
          {stateHistoryLoading && (
            <LoadingPlaceholder text={t('alerting.instance-details.loading-history', 'Loading state history...')} />
          )}
          {stateHistoryError && (
            <Alert
              severity="error"
              title={t('alerting.instance-details.history-error', 'Failed to load state history')}
            >
              {t(
                'alerting.instance-details.history-error-desc',
                'Unable to fetch state transition history for this instance.'
              )}
            </Alert>
          )}
          {!stateHistoryLoading && !stateHistoryError && (
            <Stack direction="column" gap={1}>
              {recentTransitions.length > 0 ? (
                recentTransitions.map((record, index) => (
                  <StateTransition key={`${record.timestamp}-${index}`} record={record} />
                ))
              ) : (
                <Text color="secondary">{t('alerting.instance-details.no-history', 'No recent state changes')}</Text>
              )}
            </Stack>
          )}
        </Box>
      </Stack>
    </Drawer>
  );
}

interface ErrorContentProps {
  error: unknown;
}

function ErrorContent({ error }: ErrorContentProps) {
  if (isFetchError(error) && error.status === 404) {
    return (
      <Alert title={t('alerting.triage.rule-not-found', 'Rule not found')} severity="error">
        {t('alerting.triage.rule-not-found.description', 'The requested rule could not be found.')}
      </Alert>
    );
  }

  return (
    <Alert title={t('alerting.triage.error-loading-rule', 'Error loading rule')} severity="error">
      {stringifyErrorLike(error)}
    </Alert>
  );
}
