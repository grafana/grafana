import { Observable } from 'rxjs';

import { AlertStateInfo, AnnotationEvent, AnnotationQuery, DataSourceApi, TimeRange } from '@grafana/data';
import { ThresholdDefinition } from 'app/features/alerting/unified/components/rule-editor/util';

import { DashboardModel } from '../../../dashboard/state';

export interface DashboardQueryRunnerOptions {
  dashboard: DashboardModel;
  range: TimeRange;
}

export interface DashboardQueryRunnerResult {
  annotations: AnnotationEvent[];
  alertState?: AlertStateInfo;
  threshold?: ThresholdDefinition;
}

export interface DashboardQueryRunner {
  run: (options: DashboardQueryRunnerOptions) => void;
  getResult: (panelId?: number) => Observable<DashboardQueryRunnerResult>;
  cancel: (annotation: AnnotationQuery) => void;
  cancellations: () => Observable<AnnotationQuery>;
  destroy: () => void;
}

export interface DashboardQueryRunnerWorkerResult {
  annotations: AnnotationEvent[];
  alertStates: AlertStateInfo[];
  threshold?: ThresholdDefinition;
}

export interface DashboardQueryRunnerWorker {
  canWork: (options: DashboardQueryRunnerOptions) => boolean;
  work: (options: DashboardQueryRunnerOptions) => Observable<DashboardQueryRunnerWorkerResult>;
}

export interface AnnotationQueryRunnerOptions extends DashboardQueryRunnerOptions {
  datasource?: DataSourceApi;
  annotation: AnnotationQuery;
}

export interface AnnotationQueryRunner {
  canRun: (datasource?: DataSourceApi) => boolean;
  run: (options: AnnotationQueryRunnerOptions) => Observable<AnnotationEvent[]>;
}
