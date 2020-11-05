import { defaultQuery as defaultStreamQuery } from './runStreams';
import { TestDataQuery } from './types';

export const defaultPulse: any = {
  timeStep: 60,
  onCount: 3,
  onValue: 2,
  offCount: 3,
  offValue: 1,
};

export const defaultCSVWave: any = {
  timeStep: 60,
  valuesCSV: '0,0,2,2,1,1',
};

export const defaultQuery: TestDataQuery = {
  points: [],
  stream: defaultStreamQuery,
  pulseWave: defaultPulse,
  csvWave: defaultCSVWave,
  stringInput: '',
  scenarioId: 'random_walk',
  lines: 10,
  refId: '',
  alias: '',
};
