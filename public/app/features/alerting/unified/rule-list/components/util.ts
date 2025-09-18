import { addMilliseconds, formatDistanceToNowStrict, isBefore } from 'date-fns';
import { ComponentProps } from 'react';

import { StateIcon } from '@grafana/alerting/unstable';
import { dateTime, dateTimeFormat, isValidDate } from '@grafana/data';
import { RuleHealth } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { isNullDate, parsePrometheusDuration } from '../../utils/time';

type NextEvaluation = {
  humanized: string;
  fullDate: string;
};

/**
 * Best effort estimate for when the next evaluation will occur
 * @TODO write a test for this
 * @TODO move this somewhere else probably
 */
export function calculateNextEvaluationEstimate(
  lastEvaluation?: string,
  evaluationInterval?: string
): NextEvaluation | undefined {
  if (!lastEvaluation || !evaluationInterval) {
    return;
  }

  if (!isValidDate(lastEvaluation)) {
    return;
  }

  let intervalSize: number;
  try {
    intervalSize = parsePrometheusDuration(evaluationInterval);
  } catch (error) {
    return;
  }

  // paused alert rules will have their lastEvaluation set to a nil date
  if (isNullDate(lastEvaluation)) {
    return;
  }

  const lastEvaluationDate = Date.parse(lastEvaluation || '');
  const nextEvaluationDate = addMilliseconds(lastEvaluationDate, intervalSize);

  //when `nextEvaluationDate` is a past date it means lastEvaluation was more than one evaluation interval ago.
  //in this case we use the interval value to show a more generic estimate.
  //See https://github.com/grafana/grafana/issues/65125
  const isPastDate = isBefore(nextEvaluationDate, new Date());
  if (isPastDate) {
    return {
      humanized: `within ${evaluationInterval}`,
      fullDate: `within ${evaluationInterval}`,
    };
  }

  return {
    humanized: `in ${dateTime(nextEvaluationDate).locale('en').fromNow(true)}`,
    fullDate: dateTimeFormat(nextEvaluationDate, { format: 'YYYY-MM-DD HH:mm:ss' }),
  };
}

export function getRelativeEvaluationInterval(lastEvaluation?: string) {
  if (!lastEvaluation) {
    return null;
  }

  if (isNullDate(lastEvaluation)) {
    return;
  }

  return formatDistanceToNowStrict(new Date(lastEvaluation));
}

type NormalizedHealth = ComponentProps<typeof StateIcon>['health'];
export function normalizeHealth(health?: RuleHealth): NormalizedHealth {
  if (!health) {
    return;
  }

  // backwards compatibility with Prometheus rule state
  if (health === 'err') {
    return 'error';
  }

  if (isValidHealth(health)) {
    return health;
  }

  return;
}

function isValidHealth(health: string): health is NonNullable<NormalizedHealth> {
  const valid: Array<NonNullable<NormalizedHealth>> = ['nodata', 'error'] as const;
  return valid.some((v) => v === health);
}

type NormalizedState = ComponentProps<typeof StateIcon>['state'];
export function normalizeState(state?: PromAlertingRuleState): NormalizedState {
  if (!state) {
    return 'unknown';
  }

  // backwards compatibility with Prometheus rule state
  if (state === 'inactive') {
    return 'normal';
  }

  if (isValidState(state)) {
    return state;
  }

  return;
}

function isValidState(state: string): state is NonNullable<NormalizedState> {
  const valid: Array<NonNullable<NormalizedState>> = ['normal', 'firing', 'pending', 'unknown', 'recovering'] as const;
  return valid.some((v) => v === state);
}
