import { CSVWave, PulseWaveQuery, TestDataDataQuery, TestDataQueryType } from './dataquery';

export const defaultPulseQuery: PulseWaveQuery = {
  timeStep: 60,
  onCount: 3,
  onValue: 2,
  offCount: 3,
  offValue: 1,
};

export const defaultCSVWaveQuery: CSVWave[] = [
  {
    timeStep: 60,
    valuesCSV: '0,0,2,2,1,1',
  },
];

export const defaultQuery: TestDataDataQuery = {
  scenarioId: TestDataQueryType.RandomWalk,
  refId: '',
};
