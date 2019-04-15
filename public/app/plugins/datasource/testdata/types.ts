import { DataQuery } from '@grafana/ui/src/types';

export interface TestDataQuery extends DataQuery {
  alias?: string;
  scenarioId: string;
  stringInput: string;
  points: any;
}

export interface Scenario {
  id: string;
  name: string;
}
