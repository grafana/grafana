import {
  type CSVWave,
  type PredictableAnnotationsQuery,
  type PulseWaveQuery,
  type TestDataDataQuery,
  TestDataQueryType,
} from './dataquery';

export const defaultPulseQuery: PulseWaveQuery = {
  timeStep: 60,
  onCount: 3,
  onValue: 2,
  offCount: 3,
  offValue: 1,
};

export const defaultPredictableAnnotationsQuery: PredictableAnnotationsQuery = {
  eventFrequency: '1h',
  incidentFrequency: '6h',
  incidentDuration: '10m',
  seed: 1,
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

// @todo export from logs model
export const DATAPLANE_LABEL_TYPES_NAME = 'labelTypes';
