import { LoadingState, PanelData, TimeRange } from '@grafana/data';
import { Observable, of } from 'rxjs';
import { Scene, SceneElement } from '../state/models';

export function getScene(name: string): Observable<Scene> {
  return new Observable(observer => {
    observer.next({
      title: 'Demo scene',
      elements: getDemoPanels(),
    });
  });
}

function getDemoPanels(): Observable<SceneElement[]> {
  return new Observable<SceneElement[]>(observer => {
    observer.next([
      {
        type: 'viz',
        title: 'Demo panel',
        vizId: 'bar-gauge',
        pos: { x: 0, y: 0, w: 12, h: 5 },
        data: of({
          state: LoadingState.Done,
          series: [],
          timeRange: {} as TimeRange,
        } as PanelData),
      },
      {
        type: 'viz',
        title: 'Demo panel 2',
        vizId: 'bar-gauge',
        pos: { x: 0, y: 0, w: 12, h: 5 },
        data: of({
          state: LoadingState.Done,
          series: [],
          timeRange: {} as TimeRange,
        } as PanelData),
      },
    ]);
  });
}
