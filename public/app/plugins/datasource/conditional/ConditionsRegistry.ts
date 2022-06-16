import { ConditionInfo, Registry } from '@grafana/data';

import { fieldValueClickCondition } from './conditions/fieldValueClickCondition';
import { timeRangeCondition } from './conditions/timeRangeCondition';
import { timeRangeIntervalCondition } from './conditions/timeRangeIntervalCondition';

export const conditionsRegistry = new Registry<ConditionInfo>();

export const getConditionItems = () => [fieldValueClickCondition, timeRangeCondition, timeRangeIntervalCondition];
