import { DataQuery } from '@grafana/data';

export interface Scenario {
  id: string;
  name: string;
}

export interface TestDataQuery extends DataQuery {
  alias?: string;
  scenarioId: string;
  stringInput: string;
  points?: any[];
  stream?: StreamingQuery;
}

export interface StreamingQuery {
  type: 'signal' | 'logs' | 'fetch';
  speed: number;
  spread: number;
  noise: number; // wiggle around the signal for min/max
  bands?: number; // number of bands around the middle band
  url?: string; // the Fetch URL
}
