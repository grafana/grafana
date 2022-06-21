import { DataFrameType, DataQuery } from '@grafana/data';

export interface Scenario {
  id: string;
  name: string;
  stringInput: string;
  description?: string;
  hideAliasField?: boolean;
}

export interface TestDataQuery extends DataQuery {
  alias?: string;
  scenarioId?: string;
  stringInput?: string;
  stream?: StreamingQuery;
  pulseWave?: PulseWaveQuery;
  sim?: SimulationQuery;
  csvWave?: CSVWave[];
  labels?: string;
  lines?: number;
  levelColumn?: boolean;
  channel?: string; // for grafana live
  nodes?: NodesQuery;
  heatmap?: HeatmapQuery;
  csvFileName?: string;
  csvContent?: string;
  rawFrameContent?: string;
  usa?: USAQuery;
  errorType?: 'server_panic' | 'frontend_exception' | 'frontend_observable';
}

export interface NodesQuery {
  type?: 'random' | 'response';
  count?: number;
}

export interface StreamingQuery {
  type: 'signal' | 'logs' | 'fetch';
  speed: number;
  spread: number;
  noise: number; // wiggle around the signal for min/max
  bands?: number; // number of bands around the middle band
  url?: string; // the Fetch URL
}

export interface HeatmapQuery {
  format: DataFrameType;
  scale?: 'linear' | 'log2' | 'alpha';
  nameAsLabel?: string;
  exemplars?: boolean;
  excludeFrameType?: boolean;
  numericX?: boolean; // x does not need to be time
}

export interface SimulationQuery {
  key: {
    type: string;
    tick: number;
    uid?: string;
  };
  config?: Record<string, any>;
  stream?: boolean;
  last?: boolean;
}

export interface PulseWaveQuery {
  timeStep?: number;
  onCount?: number;
  offCount?: number;
  onValue?: number;
  offValue?: number;
}
export interface CSVWave {
  timeStep?: number;
  name?: string;
  valuesCSV?: string;
  labels?: string;
}

export interface USAQuery {
  mode?: string;
  period?: string;
  fields?: string[]; // foo, bar, baz
  states?: string[];
}
