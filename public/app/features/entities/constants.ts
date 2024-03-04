import { TopDefinition } from './asserts-types';

export const ENTITY_COLUMN_MIN_WIDTH = 400;

export const DEFAULT_ENTITY_COLUMNS = ['name'];
export const MONITORING_COLUMNS = ['resource', 'traffic', 'latency'];

export const DEFAULT_TOP_DEFINITION: TopDefinition[] = [
  {
    boundDescription: 'Show all Nodes',
    rank: 1,
  },
  {
    boundDescription: 'Show all Services',
    rank: 1,
  },
];

export const ENTITY_OUT_OF_DATE_TIME = 5 * 60 * 1000;
export const OUT_OF_DATE_COLOR = '#c4c4c4';

export const DATE_FIELDS = ['discovered', 'updated', 'migrated'];

export const assertsColors = {
  critical: '#ff5151',
  warning: '#f2c222',
  info: '#6cacfd',
};
