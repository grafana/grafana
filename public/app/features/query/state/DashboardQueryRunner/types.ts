import { Observable } from 'rxjs';
import { AnnotationEvent, DataQuery, DataSourceApi, TimeRange } from '@grafana/data';

import { DashboardModel } from '../../../dashboard/state';
import { AlertStateInfo } from '../../../annotations/types';

export interface DashboardQueryRunnerOptions {
  dashboard: DashboardModel;
  range: TimeRange;
}

export interface DashboardQueryRunnerResult {
  annotations: AnnotationEvent[];
  alertState?: AlertStateInfo;
}

export interface DashboardQueryRunner {
  run: (options: DashboardQueryRunnerOptions) => void;
  getResult: (panelId: number) => Observable<DashboardQueryRunnerResult>;
  cancel: () => void;
  destroy: () => void;
}

export interface DashboardQueryRunnerWorkerResult {
  annotations: AnnotationEvent[];
  alertStates: AlertStateInfo[];
}

export interface DashboardQueryRunnerWorker {
  canRun: (options: DashboardQueryRunnerOptions) => boolean;
  run: (options: DashboardQueryRunnerOptions) => Observable<DashboardQueryRunnerWorkerResult>;
}

export interface AnnotationQueryRunnerOptions extends DashboardQueryRunnerOptions {
  datasource: DataSourceApi;
  annotation: {
    datasource: string;
    enable: boolean;
    name: string;
  } & DataQuery;
}

export interface AnnotationQueryRunner {
  canRun: (datasource: DataSourceApi) => boolean;
  run: (options: AnnotationQueryRunnerOptions) => Observable<AnnotationEvent[]>;
}
