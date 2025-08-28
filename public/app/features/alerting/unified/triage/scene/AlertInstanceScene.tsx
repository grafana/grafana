import { DataFrame, Field, Labels, PanelData } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, sceneGraph } from '@grafana/scenes';

import { AlertLabels } from '../../components/AlertLabels';
import { GroupRow } from '../GroupRow';
import { useWorkbenchContext } from '../WorkbenchContext';
import { StateChangeChart } from '../stateChangeChart/StateChangeChart';
import { TimelineEntry } from '../types';

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

function extractAlertInstances(data: PanelData): AlertInstance[] {
  if (!data?.series?.length) {
    return [];
  }

  const instances: AlertInstance[] = [];

  // Process each DataFrame (series)
  data.series.forEach((frame: DataFrame) => {
    // Find the time field
    const timeField = frame.fields.find((field) => field.type === 'time');
    if (!timeField) {
      return; // Skip frames without time data
    }

    // For timeseries data, look for value fields (non-time fields)
    frame.fields.forEach((field: Field) => {
      // Skip time fields
      if (field.type === 'time') {
        return;
      }

      // Extract labels from the field
      const labels = field.labels || {};
      const hasData = field.values && field.values.length > 0;

      // Build timeline from the timeseries data
      const dataPoints: Array<{ timestamp: number; state: 'firing' | 'pending' }> = [];

      if (hasData && timeField.values.length === field.values.length) {
        for (let i = 0; i < field.values.length; i++) {
          const timestamp = timeField.values[i];
          const value = field.values[i];

          // Convert numeric values to alert states
          // Assuming: 0 = pending, 1 = firing (adjust based on your data format)
          let state: 'firing' | 'pending' = 'pending';
          if (typeof value === 'number') {
            state = value > 0 ? 'firing' : 'pending';
          } else if (typeof value === 'string') {
            state = value === 'firing' ? 'firing' : 'pending';
          }

          dataPoints.push({ timestamp, state });
        }
      }

      const timeline = convertDataPointsToTimeline(dataPoints);

      instances.push({
        labels,
        fieldName: field.name,
        hasData,
        timeline,
      });
    });
  });

  return instances;
}

function AlertInstanceSceneRenderer({ model }: SceneComponentProps<AlertInstanceScene>) {
  const { ruleUID } = model.useState();
  const dataState = sceneGraph.getData(model).useState();
  const { domain, leftColumnWidth } = useWorkbenchContext();

  // Extract unique alert instances from timeseries data
  const alertInstances = dataState.data ? extractAlertInstances(dataState.data) : [];

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
            title={<AlertLabels labels={instance.labels} />}
            content={<StateChangeChart domain={domain} timeline={instance.timeline} />}
          />
        );
      })}
    </>
  );
}

export function getAlertInstanceScene(ruleUID: string): AlertInstanceScene {
  return new AlertInstanceScene({
    $data: getQueryRunner(`${METRIC_NAME}{grafana_rule_uid="${ruleUID}"}`, {
      format: 'timeseries',
    }),
    ruleUID,
  });
}
