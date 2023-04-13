import { SelectableValue } from '@grafana/data/src';

import { AddDBClusterFormValues } from '../EditDBClusterPage.types';

import { Messages } from './DBClusterAdvancedOptions.messages';
import { DBClusterResources, DBClusterDefaultResources } from './DBClusterAdvancedOptions.types';

export const RESOURCES_OPTIONS: SelectableValue[] = [
  { value: DBClusterResources.small, label: Messages.resources.small },
  { value: DBClusterResources.medium, label: Messages.resources.medium },
  { value: DBClusterResources.large, label: Messages.resources.large },
  { value: DBClusterResources.custom, label: Messages.resources.custom },
];

export const DEFAULT_SIZES: DBClusterDefaultResources = {
  small: {
    memory: 2,
    cpu: 1,
    disk: 25,
  },
  medium: {
    memory: 8,
    cpu: 4,
    disk: 100,
  },
  large: {
    memory: 32,
    cpu: 8,
    disk: 500,
  },
};

export const INITIAL_VALUES: AddDBClusterFormValues = {
  nodes: 3,
  resources: DBClusterResources.small,
  memory: DEFAULT_SIZES.small.memory,
  cpu: DEFAULT_SIZES.small.cpu,
  disk: DEFAULT_SIZES.small.disk,
  sourceRanges: [{ sourceRange: '' }],
  day: [],
  month: [],
  period: { value: 'year', label: 'every year' },
  startHour: [{ label: '00', value: 0 }],
  startMinute: [{ value: 0, label: '00' }],
  weekDay: [],
};

export const MIN_NODES = 1;
export const MIN_RESOURCES = 0.1;
export const MIN_DISK_SIZE = 1;
export const RECHECK_INTERVAL = 10000;
export const EXPECTED_DELAY = 250;
