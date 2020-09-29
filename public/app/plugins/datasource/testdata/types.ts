import { DataQuery } from '@grafana/data';

export interface Scenario {
  id: string;
  name: string;
  stringInput: string;
}

export interface TestDataQuery extends DataQuery {
  alias?: string;
  scenarioId: string;
  stringInput: string;
  points?: any[];
  stream?: StreamingQuery;
  pulseWave: PulseWaveQuery;
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
  timeStep: number;
  onCount: number;
  offCount: number;
  onValue: number;
  offValue: number;
}
