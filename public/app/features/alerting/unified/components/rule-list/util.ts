import {
  addMilliseconds,
  differenceInMilliseconds,
  formatDistanceToNow,
  formatDistanceToNowStrict,
  isBefore,
} from 'date-fns';

import { dateTime, dateTimeFormat, isValidDate } from '@grafana/data';

import { formatPrometheusDuration, isNullDate, parsePrometheusDuration } from '../../utils/time';

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
      humanized: `within ${formatDistanceToNow(nextEvaluationDate)}`,
      fullDate: `within ${formatDistanceToNow(nextEvaluationDate)}`,
    };
  }

  return {
    humanized: `in ${dateTime(nextEvaluationDate).locale('en').fromNow(true)}`,
    fullDate: dateTimeFormat(nextEvaluationDate, { format: 'YYYY-MM-DD HH:mm:ss' }),
  };
}

export function getRelativeEvaluationInterval(evaluationInterval?: string, lastEvaluation?: string) {
  if (!lastEvaluation || !evaluationInterval) {
    return null;
  }

  if (isNullDate(lastEvaluation)) {
    return;
  }

  const diffMillis = differenceInMilliseconds(new Date(lastEvaluation), new Date());
  // let's round to seconds because we don't care about the millis
  const roundedDiff = Math.round(diffMillis / 1000) * 1000;

  return formatPrometheusDuration(roundedDiff);
}
