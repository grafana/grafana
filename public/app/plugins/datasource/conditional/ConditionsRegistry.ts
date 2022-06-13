import { ConditionInfo, Registry } from '@grafana/data';

import { fieldValueClickCondition } from './conditions/fieldValueClickCondition';
import { timeRangeCondition } from './conditions/timeRangeCondition';

export const conditionsRegistry = new Registry<ConditionInfo>();

export const getConditionItems = () => [fieldValueClickCondition, timeRangeCondition];
