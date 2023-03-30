import { isUndefined, omitBy, sum } from 'lodash';
import pluralize from 'pluralize';
import React, { Fragment } from 'react';

import { Stack } from '@grafana/experimental';
import { Badge } from '@grafana/ui';
import {
  AlertGroupTotals,
  AlertInstanceState,
  CombinedRuleGroup,
  CombinedRuleNamespace,
} from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

interface Props {
  namespaces: CombinedRuleNamespace[];
}

// All available states for a rule need to be initialized to prevent NaN values when adding a number and undefined
const emptyStats: Required<AlertGroupTotals> = {
  recording: 0,
  alerting: 0,
  [PromAlertingRuleState.Pending]: 0,
  [PromAlertingRuleState.Inactive]: 0,
  paused: 0,
  error: 0,
  nodata: 0,
};

export const RuleStats = ({ namespaces }: Props) => {
  const stats = { ...emptyStats };

  // sum all totals for all namespaces
  namespaces.forEach(({ groups }) => {
    groups.forEach((group) => {
      const groupTotals = omitBy(group.totals, isUndefined);
      for (let key in groupTotals) {
        // @ts-ignore
        stats[key] += groupTotals[key];
      }
    });
  });

  const statsComponents = getComponentsFromStats(stats);
  const hasStats = Boolean(statsComponents.length);

  const total = sum(Object.values(stats));

  statsComponents.unshift(
    <Fragment key="total">
      {total} {pluralize('rule', total)}
    </Fragment>
  );

  return (
    <Stack direction="row">
      {hasStats && (
        <div>
          <Stack gap={0.5}>{statsComponents}</Stack>
        </div>
      )}
    </Stack>
  );
};

interface RuleGroupStatsProps {
  group: CombinedRuleGroup;
}

export const RuleGroupStats = ({ group }: RuleGroupStatsProps) => {
  const stats = group.totals;
  const evaluationInterval = group?.interval;

  const statsComponents = getComponentsFromStats(stats);
  const hasStats = Boolean(statsComponents.length);

  return (
    <Stack direction="row">
      {hasStats && (
        <div>
          <Stack gap={0.5}>{statsComponents}</Stack>
        </div>
      )}
      {evaluationInterval && (
        <>
          <div>|</div>
          <Badge text={evaluationInterval} icon="clock-nine" color={'blue'} />
        </>
      )}
    </Stack>
  );
};
function getComponentsFromStats(stats: Partial<Record<AlertInstanceState | 'paused' | 'recording', number>>) {
  const statsComponents: React.ReactNode[] = [];

  if (stats[AlertInstanceState.Alerting]) {
    statsComponents.push(<Badge color="red" key="firing" text={`${stats[AlertInstanceState.Alerting]} firing`} />);
  }

  if (stats.error) {
    statsComponents.push(<Badge color="red" key="errors" text={`${stats.error} errors`} />);
  }

  if (stats[AlertInstanceState.Pending]) {
    statsComponents.push(
      <Badge color={'orange'} key="pending" text={`${stats[AlertInstanceState.Pending]} pending`} />
    );
  }

  if (stats[AlertInstanceState.Normal] && stats.paused) {
    statsComponents.push(
      <Badge color="green" key="paused" text={`${stats[AlertInstanceState.Normal]} normal (${stats.paused} paused)`} />
    );
  }

  if (stats[AlertInstanceState.Normal] && !stats.paused) {
    statsComponents.push(<Badge color="green" key="inactive" text={`${stats[AlertInstanceState.Normal]} normal`} />);
  }

  if (stats.recording) {
    statsComponents.push(<Badge color="purple" key="recording" text={`${stats.recording} recording`} />);
  }

  return statsComponents;
}
