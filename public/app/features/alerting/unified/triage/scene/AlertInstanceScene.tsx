import { DataFrame, Field, Labels, PanelData, findCommonLabels } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import {
  DataProviderProxy,
  EmbeddedScene,
  PanelBuilders,
  SceneComponentProps,
  SceneDataTransformer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  sceneGraph,
} from '@grafana/scenes';
import {
  AxisPlacement,
  GraphDrawStyle,
  LegendDisplayMode,
  LineInterpolation,
  StackingMode,
  TooltipDisplayMode,
  VisibilityMode,
} from '@grafana/schema';

import { AlertLabels } from '../../components/AlertLabels';
import { overrideToFixedColor } from '../../home/Insights';
import { GroupRow } from '../GroupRow';
import { useWorkbenchContext } from '../WorkbenchContext';
import { StateChangeChart } from '../stateChangeChart/StateChangeChart';
import { TimelineEntry } from '../types';

import { triageScene } from './TriageScene';
import { METRIC_NAME, getQueryRunner } from './utils';

interface AlertInstanceSceneState extends SceneObjectState {
  ruleUID: string;
}

export class AlertInstanceScene extends SceneObjectBase<AlertInstanceSceneState> {
  public static Component = AlertInstanceSceneRenderer;

  constructor(state: AlertInstanceSceneState) {
    super(state);
  }

  public getRuleUID(): string {
    return this.state.ruleUID;
  }
}

interface AlertInstance {
  labels: Labels;
  fieldName: string;
  hasData: boolean;
  timeline: TimelineEntry[];
}

function convertDataPointsToTimeline(
  dataPoints: Array<{ timestamp: number; state: 'firing' | 'pending' }>
): TimelineEntry[] {
  const timestampStateMap = new Map<number, 'firing' | 'pending'>();

  dataPoints.forEach((dataPoint) => {
    const { timestamp, state } = dataPoint;
    const existingState = timestampStateMap.get(timestamp);

    // Set the state if:
    // 1. No state exists for this timestamp yet, OR
    // 2. Current state is 'firing' and existing state is 'pending' (firing takes precedence)
    const shouldUpdateState = !existingState || (state === 'firing' && existingState === 'pending');

    if (shouldUpdateState) {
      timestampStateMap.set(timestamp, state);
    }
  });

  // Create timeline as array of [timestamp, state] tuples, sorted by time
  const timeline: TimelineEntry[] = Array.from(timestampStateMap.entries()).sort(
    ([timestampA], [timestampB]) => timestampA - timestampB
  );

  return timeline;
}

export function extractAlertInstances(data: PanelData): AlertInstance[] {
  if (!data?.series?.length) {
    return [];
  }

  type Group = {
    labels: Labels;
    fieldName: string;
    hasData: boolean;
    dataPoints: Array<{ timestamp: number; state: 'firing' | 'pending' }>;
  };

  const groups: Map<string, Group> = new Map();

  const normalizeLabels = (labels: Labels): Labels => {
    const result: Labels = {};
    const source = labels || {};
    for (const key of Object.keys(source)) {
      if (key === 'alertstate' || key === 'grafana_alertstate') {
        continue;
      }
      result[key] = source[key] as string;
    }
    return result;
  };

  const labelsKey = (labels: Labels): string => {
    const keys = Object.keys(labels).sort();
    return keys.map((k) => `${k}=${labels[k]}`).join('|');
  };

  // Process each DataFrame (series)
  data.series.forEach((frame: DataFrame) => {
    const timeField = frame.fields.find((field) => field.type === 'time');
    if (!timeField) {
      return;
    }

    frame.fields.forEach((field: Field) => {
      if (field.type === 'time') {
        return;
      }

      const rawLabels = field.labels || {};
      const baseLabels = normalizeLabels(rawLabels);
      const key = labelsKey(baseLabels);

      let group = groups.get(key);
      if (!group) {
        group = { labels: baseLabels, fieldName: field.name, hasData: false, dataPoints: [] };
        groups.set(key, group);
      }

      const hasData = !!(field.values && field.values.length > 0);
      group.hasData = group.hasData || hasData;

      if (hasData && timeField.values.length === field.values.length) {
        const stateFromLabel = (rawLabels.alertstate as 'firing' | 'pending') || 'pending';
        for (let i = 0; i < field.values.length; i++) {
          const timestamp = timeField.values[i] as number;
          group.dataPoints.push({ timestamp, state: stateFromLabel });
        }
      }
    });
  });

  const instances: AlertInstance[] = [];
  for (const group of groups.values()) {
    const timeline = convertDataPointsToTimeline(group.dataPoints);
    instances.push({
      labels: group.labels,
      fieldName: group.fieldName,
      hasData: group.hasData,
      timeline,
    });
  }

  return instances;
}

function AlertInstanceSceneRenderer({ model }: SceneComponentProps<AlertInstanceScene>) {
  const { ruleUID } = model.useState();
  const dataState = sceneGraph.getData(model).useState();

  const { leftColumnWidth, domain } = useWorkbenchContext();

  // Extract unique alert instances from timeseries data
  const alertInstances = dataState.data ? extractAlertInstances(dataState.data) : [];

  const commonLabels = findCommonLabels(alertInstances.map((instance) => instance.labels));

  if (alertInstances.length === 0) {
    return (
      <GroupRow
        width={leftColumnWidth}
        title={<Trans i18nKey="alerting.triage.alert-instances">Alert instances</Trans>}
      >
        <div>
          <Trans i18nKey="alerting.triage.no-instances-found">No alert instances found for rule: {ruleUID}</Trans>
        </div>
      </GroupRow>
    );
  }

  return (
    <>
      {alertInstances.map((instance, index) => {
        return (
          <GroupRow
            key={index}
            width={leftColumnWidth}
            title={<AlertLabels labels={instance.labels} commonLabels={commonLabels} />}
            content={<StateChangeChart domain={domain} timeline={instance.timeline} />}
          />
        );
      })}
    </>
  );
}

export function getAlertInstanceScene(ruleUID: string): AlertInstanceScene {
  return new AlertInstanceScene({
    $data: getQueryRunner(
      `count without (alertname, grafana_alertstate, grafana_folder, grafana_rule_uid) (${METRIC_NAME}{grafana_rule_uid="${ruleUID}"})`,
      { format: 'timeseries' }
    ),
    ruleUID,
  });
}

export const getAlertRuleScene = (ruleUID: string) => {
  // Build the timeseries panel and hide its header (hover-only)
  const headerlessPanel = PanelBuilders.timeseries()
    .setTitle('')
    .setHoverHeader(true)
    .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
    .setCustomFieldConfig('lineInterpolation', LineInterpolation.StepBefore)
    .setCustomFieldConfig('showPoints', VisibilityMode.Never)
    .setCustomFieldConfig('fillOpacity', 30)
    .setCustomFieldConfig('stacking', { mode: StackingMode.None })
    .setCustomFieldConfig('axisPlacement', AxisPlacement.Hidden)
    .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
    .setOption('legend', {
      showLegend: false,
      displayMode: LegendDisplayMode.Hidden,
    })
    .setOverrides((builder) =>
      builder
        .matchFieldsWithName('firing')
        .overrideColor(overrideToFixedColor('firing'))
        .matchFieldsWithName('pending')
        .overrideColor(overrideToFixedColor('pending'))
    )
    .setNoValue('0')
    .build();

  return new EmbeddedScene({
    $data: new SceneDataTransformer({
      $data: new DataProviderProxy({ source: new SceneObjectRef(sceneGraph.getData(triageScene)) }),
      transformations: [
        {
          id: 'filterByValue',
          options: {
            filters: [
              {
                config: {
                  id: 'equal',
                  options: {
                    value: ruleUID,
                  },
                },
                fieldName: 'grafana_rule_uid',
              },
            ],
            match: 'any',
            type: 'include',
          },
        },
        {
          id: 'partitionByValues',
          options: {
            fields: ['alertstate'],
            keepFields: false,
            naming: {
              asLabels: true,
            },
          },
        },
      ],
    }),
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          minHeight: 60,
          body: headerlessPanel,
        }),
      ],
    }),
  });
};

export function AlertRuleStateChart({ ruleUID }: { ruleUID: string }) {
  const alertRuleScene = getAlertRuleScene(ruleUID);

  if (!alertRuleScene) {
    return null;
  }

  return <alertRuleScene.Component model={alertRuleScene} />;
}
