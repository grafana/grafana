import { DataQuery } from '@grafana/data';

export interface Scenario {
  id: string;
  name: string;
  stringInput: string;
}

export type PointValue = number;

export interface NewPoint {
  newPointValue: string;
  newPointTime: string;
}
export type Points = PointValue[][];

export interface TestDataQuery extends DataQuery {
  alias?: string;
  scenarioId: string;
  stringInput: string;
  points: Points;
  stream?: StreamingQuery;
  pulseWave?: PulseWaveQuery;
  csvWave: any;
  labels?: string;
  lines?: number;
  levelColumn?: boolean;
  channel?: string; // for grafana live
}

export interface StreamingQuery {
  type: 'signal' | 'logs' | 'fetch';
  speed: number;
  spread: number;
  noise: number; // wiggle around the signal for min/max
  bands?: number; // number of bands around the middle band
  url?: string; // the Fetch URL
}

export interface PulseWaveQuery {
  timeStep?: number;
  onCount?: number;
  offCount?: number;
  onValue?: number;
  offValue?: number;
}
