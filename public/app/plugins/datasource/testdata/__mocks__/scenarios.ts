import { TestDataQueryType } from '../dataquery.gen';

export const scenarios = [
  {
    description: '',
    id: TestDataQueryType.Annotations,
    name: 'Annotations',
    stringInput: '',
  },
  {
    description: '',
    id: TestDataQueryType.Arrow,
    name: 'Load Apache Arrow Data',
    stringInput: '',
  },
  {
    description: '',
    id: TestDataQueryType.CSVMetricValues,
    name: 'CSV Metric Values',
    stringInput: '1,20,90,30,5,0',
  },
  {
    description: '',
    id: TestDataQueryType.DataPointsOutsideRange,
    name: 'Datapoints Outside Range',
    stringInput: '',
  },
  {
    description: '',
    id: TestDataQueryType.ExponentialHeatmapBucketData,
    name: 'Exponential heatmap bucket data',
    stringInput: '',
  },
  {
    description: '',
    id: TestDataQueryType.GrafanaAPI,
    name: 'Grafana API',
    stringInput: '',
  },
  {
    description: '',
    id: TestDataQueryType.LinearHeatmapBucketData,
    name: 'Linear heatmap bucket data',
    stringInput: '',
  },
  {
    description: '',
    id: TestDataQueryType.Logs,
    name: 'Logs',
    stringInput: '',
  },
  {
    description: '',
    id: TestDataQueryType.ManualEntry,
    name: 'Manual Entry',
    stringInput: '',
  },
  {
    description: '',
    id: TestDataQueryType.NoDataPoints,
    name: 'No Data Points',
    stringInput: '',
  },
  {
    description: '',
    id: TestDataQueryType.PredictableCSVWave,
    name: 'Predictable CSV Wave',
    stringInput: '',
  },
  {
    description:
      'Predictable Pulse returns a pulse wave where there is a datapoint every timeStepSeconds.\nThe wave cycles at timeStepSeconds*(onCount+offCount).\nThe cycle of the wave is based off of absolute time (from the epoch) which makes it predictable.\nTimestamps will line up evenly on timeStepSeconds (For example, 60 seconds means times will all end in :00 seconds).',
    id: TestDataQueryType.PredictablePulse,
    name: 'Predictable Pulse',
    stringInput: '',
  },
  {
    description: '',
    id: TestDataQueryType.RandomWalk,
    name: 'Random Walk',
    stringInput: '',
  },
  {
    description: '',
    id: TestDataQueryType.RandomWalkTable,
    name: 'Random Walk Table',
    stringInput: '',
  },
  {
    description: '',
    id: TestDataQueryType.RandomWalkWithError,
    name: 'Random Walk (with error)',
    stringInput: '',
  },
  {
    description: '',
    id: TestDataQueryType.ServerError500,
    name: 'Server Error (500)',
    stringInput: '',
  },
  {
    description: '',
    id: TestDataQueryType.SlowQuery,
    name: 'Slow Query',
    stringInput: '5s',
  },
  {
    description: '',
    id: TestDataQueryType.StreamingClient,
    name: 'Streaming Client',
    stringInput: '',
  },
  {
    description: '',
    id: TestDataQueryType.TableStatic,
    name: 'Table Static',
    stringInput: '',
  },
  {
    description: '',
    id: TestDataQueryType.FlameGraph,
    name: 'Flame Graph',
    stringInput: '',
  },
];
