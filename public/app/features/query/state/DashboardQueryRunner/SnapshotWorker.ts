import { DashboardQueryRunnerOptions, DashboardQueryRunnerWorker, DashboardQueryRunnerWorkerResult } from './types';
import { Observable, of } from 'rxjs';
import { AnnotationEvent } from '@grafana/data';
import cloneDeep from 'lodash/cloneDeep';
import { emptyResult } from './DashboardQueryRunner';

export class SnapshotWorker implements DashboardQueryRunnerWorker {
  canRun({ dashboard }: DashboardQueryRunnerOptions): boolean {
    const snapshots = dashboard.annotations.list.find((a) => a.enable && Boolean(a.snapshotData));
    return Boolean(snapshots);
  }

  run(options: DashboardQueryRunnerOptions): Observable<DashboardQueryRunnerWorkerResult> {
    if (!this.canRun(options)) {
      return emptyResult();
    }

    console.log('Running SnapshotWorker');
    const { dashboard } = options;
    const dashAnnotations = dashboard.annotations.list.filter((a) => a.enable);
    const snapshots = dashAnnotations.filter((a) => Boolean(a.snapshotData));
    const annotations = snapshots.reduce((acc, curr) => {
      return acc.concat(SnapshotWorker.translateQueryResult(curr, curr.snapshotData));
    }, [] as AnnotationEvent[]);

    return of({ annotations, alertStates: [] });
  }

  private static translateQueryResult(annotation: any, results: AnnotationEvent[]): AnnotationEvent[] {
    annotation = cloneDeep(annotation);
    delete annotation.snapshotData;

    for (const item of results) {
      item.source = annotation;
      item.color = annotation.iconColor;
      item.type = annotation.name;
      item.isRegion = Boolean(item.timeEnd && item.time !== item.timeEnd);
    }

    return results;
  }
}
