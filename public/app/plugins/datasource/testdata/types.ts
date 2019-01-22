import { DataQuery } from '@grafana/ui/src/types';

export interface TestDataQuery extends DataQuery {
  scenarioId: string;
}

export interface Scenario {
  id: string;
  name: string;
}

