import { DataFrame, Field, Labels, PanelData, findCommonLabels } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useQueryRunner } from '@grafana/scenes-react';

import { AlertLabels } from '../../components/AlertLabels';
import { GroupRow } from '../GroupRow';
import { useWorkbenchContext } from '../WorkbenchContext';
import { StateChangeChart } from '../stateChangeChart/StateChangeChart';
import { TimelineEntry } from '../types';

import { METRIC_NAME, getDataQuery } from './utils';

export function AlertRuleDetails({ ruleUID }: { ruleUID: string }) {
  const { leftColumnWidth, domain } = useWorkbenchContext();

  const query = getDataQuery(
    `count without (alertname, grafana_alertstate, grafana_folder, grafana_rule_uid) (${METRIC_NAME}{grafana_rule_uid="${ruleUID}"})`,
    { format: 'timeseries' }
  );
  const queryRunner = useQueryRunner({ queries: [query] });
  const { data } = queryRunner.useState();

  const alertInstances = data ? extractAlertInstances(data) : [];
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

interface AlertInstance {
  labels: Labels;
  fieldName: string;
  hasData: boolean;
  timeline: TimelineEntry[];
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
