import { css } from '@emotion/css';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { GrafanaTheme2, VariableHide } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  AdHocFiltersVariable,
  CustomVariable,
  EmbeddedScene,
  PanelBuilders,
  SceneComponentProps,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneQueryRunner,
  SceneReactObject,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueSelectors,
  sceneGraph,
  useUrlSync,
} from '@grafana/scenes';
import { GraphDrawStyle, VisibilityMode } from '@grafana/schema';
import {
  Button,
  GraphGradientMode,
  LegendDisplayMode,
  LineInterpolation,
  ScaleDistribution,
  StackingMode,
  Text,
  Tooltip,
  TooltipDisplayMode,
  useStyles2,
} from '@grafana/ui';

import { LogMessages, logInfo } from '../Analytics';
import { prometheusExpressionBuilder } from '../triage/scene/expressionBuilder';

import { NotificationsListObject } from './NotificationsListSceneObject';
import {
  ensureNotificationsDataSourceRegistered,
  getNotifications,
  notificationsDatasource,
} from './NotificationsRuntimeDataSource';
import { LABELS_FILTER, OUTCOME_FILTER, RECEIVER_FILTER, STATUS_FILTER } from './constants';

interface NotificationsSceneProps {
  defaultLabelsFilter?: string;
  defaultTimeRange?: {
    from: string;
    to: string;
  };
  hideFilters?: boolean;
}

/**
 * This scene shows the history of notification events.
 * It shows a list of notification events with filtering capabilities.
 */
export const NotificationsScene = ({
  defaultLabelsFilter,
  defaultTimeRange = {
    from: 'now-1h',
    to: 'now',
  },
  hideFilters,
}: NotificationsSceneProps = {}) => {
  const [isDataSourceReady, setIsDataSourceReady] = useState(false);
  const [availableKeys, setAvailableKeys] = useState<Array<{ text: string; value: string }>>(() => {
    // Fallback keys if API query fails
    const fallbackKeys = ['alertname', 'severity', 'namespace', 'cluster', 'job', 'instance', 'grafana_folder'];
    return fallbackKeys.map((key) => ({ text: key, value: key }));
  });
  const [, setAvailableValues] = useState<Record<string, Array<{ text: string; value: string }>>>({});
  const [availableReceivers, setAvailableReceivers] = useState<string[]>([]);

  useEffect(() => {
    logInfo(LogMessages.loadedCentralAlertStateHistory);
  }, []);

  // Register datasource using layout effect to ensure it runs before child renders
  useLayoutEffect(() => {
    ensureNotificationsDataSourceRegistered();
    setIsDataSourceReady(true);
  }, []);

  // Fetch available label keys from recent notifications
  useEffect(() => {
    const fetchAvailableKeys = async () => {
      try {
        // Query recent notifications to get available label keys
        const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // Last 7 days
        const to = new Date().toISOString();

        const notifications = await getNotifications(from, to, undefined, undefined, undefined, []);

        // Extract unique label keys and values from notifications
        const keysSet = new Set<string>();
        const valuesMap = new Map<string, Set<string>>();
        const receiversSet = new Set<string>();
        const entries = notifications.entries ?? [];

        entries.forEach((entry) => {
          if (entry.groupLabels) {
            Object.entries(entry.groupLabels).forEach(([key, value]) => {
              keysSet.add(key);

              if (!valuesMap.has(key)) {
                valuesMap.set(key, new Set());
              }
              valuesMap.get(key)!.add(String(value));
            });
          }

          // Extract receiver/contact point names
          if (entry.receiver) {
            receiversSet.add(entry.receiver);
          }
        });

        if (keysSet.size > 0) {
          const dynamicKeys = Array.from(keysSet)
            .sort()
            .map((key) => ({ text: key, value: key }));
          setAvailableKeys(dynamicKeys);
        }

        // Convert values map to the format needed
        const valuesRecord: Record<string, Array<{ text: string; value: string }>> = {};
        valuesMap.forEach((values, key) => {
          valuesRecord[key] = Array.from(values)
            .sort()
            .map((val) => ({ text: val, value: val }));
        });
        setAvailableValues(valuesRecord);

        // Set available receivers
        if (receiversSet.size > 0) {
          setAvailableReceivers(Array.from(receiversSet).sort());
        }
      } catch {
        // Keep fallback keys if fetching available label keys fails
      }
    };

    fetchAvailableKeys();
  }, []);

  const scene = useMemo(() => {
    if (!isDataSourceReady) {
      // Return a minimal scene object that won't cause issues with useUrlSync
      // We'll replace this with the real scene once datasource is ready
      return new EmbeddedScene({
        body: new SceneFlexLayout({ children: [] }),
      });
    }

    // Create the variables for the filters
    // Ad-hoc filters variable for filtering by labels
    // Note: No datasource specified because runtime datasources aren't accessible to AdHocFiltersVariable.
    // Users will need to manually type label keys (allowCustomValue handles this).
    const labelsFilterVariable = new AdHocFiltersVariable({
      name: LABELS_FILTER,
      label: t('alerting.notifications-scene.labels-filter-variable.label.labels', 'Labels'),
      allowCustomValue: true,
      layout: 'combobox',
      applyMode: 'manual',
      supportsMultiValueOperators: true,
      expressionBuilder: prometheusExpressionBuilder,
      filters: [],
      defaultKeys: availableKeys,
      // Note: AdHocFiltersVariable doesn't support providing default values without a datasource
      // Users will need to type values manually, or we'd need to use the datasource approach
      // TODO: Configure default filters if defaultLabelsFilter is provided
    });

    // Custom variable for filtering by status
    const statusFilterVariable = new CustomVariable({
      name: STATUS_FILTER,
      value: 'all',
      label: t('alerting.notifications-scene.status-filter-variable.label.status', 'Status:'),
      hide: VariableHide.dontHide,
      query: `All : all, Firing : firing, Resolved : resolved`,
    });

    // Custom variable for filtering by outcome
    const outcomeFilterVariable = new CustomVariable({
      name: OUTCOME_FILTER,
      value: 'all',
      label: t('alerting.notifications-scene.outcome-filter-variable.label.outcome', 'Outcome:'),
      hide: VariableHide.dontHide,
      query: `All : all, Success : success, Failed : error`,
    });

    // Dropdown variable for filtering by receiver/contact point
    const receiverFilterVariable = new CustomVariable({
      name: RECEIVER_FILTER,
      label: t('alerting.notifications-scene.receiver-filter-variable.label.receiver', 'Contact point:'),
      value: 'all',
      hide: VariableHide.dontHide,
      query:
        availableReceivers.length > 0
          ? `All : all, ${availableReceivers.map((receiver) => `${receiver} : ${receiver}`).join(', ')}`
          : 'All : all',
    });

    return new EmbeddedScene({
      controls: hideFilters
        ? undefined
        : [
            new SceneReactObject({
              component: LabelFilter,
            }),
            new VariableValueSelectors({}),
            new ClearFilterButtonScenesObject({}),
            new SceneControlsSpacer(),
            new SceneTimePicker({}),
            new SceneRefreshPicker({}),
          ],
      $timeRange: new SceneTimeRange(defaultTimeRange),
      $variables: new SceneVariableSet({
        variables: [labelsFilterVariable, statusFilterVariable, outcomeFilterVariable, receiverFilterVariable],
      }),
      body: new SceneFlexLayout({
        direction: 'column',
        children: [
          getNotificationsGraphSceneFlexItem(),
          new SceneFlexItem({
            body: new NotificationsListObject({}),
          }),
        ],
      }),
    });
  }, [defaultTimeRange, hideFilters, isDataSourceReady, availableKeys, availableReceivers]);

  const isUrlSyncInitialized = useUrlSync(scene);

  // Show empty state until datasource is ready and URL sync is initialized
  if (!isDataSourceReady || !isUrlSyncInitialized) {
    return null;
  }

  return <scene.Component model={scene} />;
};

/**
 * Creates a SceneQueryRunner with the datasource information for the runtime datasource.
 * @returns the SceneQueryRunner
 */
function getQueryRunnerForNotificationsDataSource() {
  const query = new SceneQueryRunner({
    datasource: notificationsDatasource,
    queries: [
      {
        refId: 'A',
        statusFilter: '${STATUS_FILTER}',
        outcomeFilter: '${OUTCOME_FILTER}',
        receiverFilter: '${RECEIVER_FILTER}',
        labelFilter: '${LABELS_FILTER}',
      },
    ],
  });
  return query;
}

/**
 * This function creates a SceneFlexItem with a timeseries panel that shows the notification events.
 * The query uses a runtime datasource that fetches the events from the notifications api.
 */
export function getNotificationsGraphSceneFlexItem() {
  return new SceneFlexItem({
    minHeight: 300,
    ySizing: 'content',
    body: PanelBuilders.timeseries()
      .setTitle('Notification Events')
      .setDescription(
        'Each notification event represents when an alert notification was sent to a contact point. The history of the data is displayed over a period of time.'
      )
      .setData(getQueryRunnerForNotificationsDataSource())
      .setColor({ mode: 'continuous-BlPu' })
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Bars)
      .setCustomFieldConfig('lineInterpolation', LineInterpolation.Linear)
      .setCustomFieldConfig('lineWidth', 1)
      .setCustomFieldConfig('barAlignment', 0)
      .setCustomFieldConfig('spanNulls', false)
      .setCustomFieldConfig('insertNulls', false)
      .setCustomFieldConfig('showPoints', VisibilityMode.Auto)
      .setCustomFieldConfig('pointSize', 5)
      .setCustomFieldConfig('stacking', { mode: StackingMode.None, group: 'A' })
      .setCustomFieldConfig('gradientMode', GraphGradientMode.Hue)
      .setCustomFieldConfig('scaleDistribution', { type: ScaleDistribution.Linear })
      .setOption('legend', { showLegend: false, displayMode: LegendDisplayMode.Hidden })
      .setOption('tooltip', { mode: TooltipDisplayMode.Single })
      .setNoValue('No events found')
      .build(),
  });
}

export class ClearFilterButtonScenesObject extends SceneObjectBase {
  public static Component = ClearFilterButtonObjectRenderer;

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [LABELS_FILTER, STATUS_FILTER, OUTCOME_FILTER, RECEIVER_FILTER],
  });
}

export function ClearFilterButtonObjectRenderer({ model }: SceneComponentProps<ClearFilterButtonScenesObject>) {
  model.useState();

  const labelsFilterVariable = sceneGraph.lookupVariable(LABELS_FILTER, model);
  const hasLabelsFilter =
    labelsFilterVariable instanceof AdHocFiltersVariable && labelsFilterVariable.state.filters.length > 0;
  const status = sceneGraph.interpolate(model, '${STATUS_FILTER}');
  const outcome = sceneGraph.interpolate(model, '${OUTCOME_FILTER}');
  const receiver = sceneGraph.interpolate(model, '${RECEIVER_FILTER}');

  // If no filter is active, return null
  if (!hasLabelsFilter && status === 'all' && outcome === 'all' && receiver === 'all') {
    return null;
  }

  const onClearFilter = () => {
    const labelsFiltersVariable = sceneGraph.lookupVariable(LABELS_FILTER, model);
    if (labelsFiltersVariable instanceof AdHocFiltersVariable) {
      labelsFiltersVariable.setState({ filters: [] });
    }

    const statusFilterVariable = sceneGraph.lookupVariable(STATUS_FILTER, model);
    if (statusFilterVariable instanceof CustomVariable) {
      statusFilterVariable.changeValueTo('all');
    }

    const outcomeFilterVariable = sceneGraph.lookupVariable(OUTCOME_FILTER, model);
    if (outcomeFilterVariable instanceof CustomVariable) {
      outcomeFilterVariable.changeValueTo('all');
    }

    const receiverFilterVariable = sceneGraph.lookupVariable(RECEIVER_FILTER, model);
    if (receiverFilterVariable instanceof CustomVariable) {
      receiverFilterVariable.changeValueTo('all');
    }
  };

  return (
    <Tooltip content={t('alerting.clear-filter-button-object-renderer.content-clear-filter', 'Clear filter')}>
      <Button variant={'secondary'} icon="times" onClick={onClearFilter}>
        <Trans i18nKey="alerting.notifications-scene.filter.clear">Clear filters</Trans>
      </Button>
    </Tooltip>
  );
}

const LabelFilter = () => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.filterLabelContainer}>
      <Text variant="body" weight="light" color="secondary">
        <Trans i18nKey="alerting.notifications-scene.filterBy">Filter by:</Trans>
      </Text>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    filterLabelContainer: css({
      padding: '0',
      alignSelf: 'center',
    }),
  };
};

export default NotificationsScene;
