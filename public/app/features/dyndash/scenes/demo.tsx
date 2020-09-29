import React from 'react';
import { LoadingState, PanelData, TimeRange } from '@grafana/data';
import { Button } from '@grafana/ui';
import { Observable, of } from 'rxjs';
import { Scene, ScenePanel } from '../models';

export function getDemoScene(name: string): Observable<Scene> {
  return new Observable(observer => {
    const scene = {
      title: 'Demo scene',
      panels: getDemoPanels(),
    };

    observer.next(scene);
  });
}

function getDemoPanels(): Observable<ScenePanel[]> {
  return new Observable<ScenePanel[]>(observer => {
    const panels: ScenePanel[] = [];

    panels.push({
      id: 'A',
      type: 'viz',
      title: 'Demo panel',
      vizId: 'bar-gauge',
      gridPos: { x: 0, y: 0, w: 12, h: 5 },
      data: of({
        state: LoadingState.Done,
        series: [],
        timeRange: {} as TimeRange,
      } as PanelData),
    });

    const onButtonHit = () => {
      panels.push({
        id: panels.length.toString(),
        type: 'viz',
        title: 'Demo panel ' + panels.length,
        vizId: 'bar-gauge',
        gridPos: { x: 0, y: 0, w: 12, h: 5 },
        data: of({
          state: LoadingState.Done,
          series: [],
          timeRange: {} as TimeRange,
        } as PanelData),
      });
      observer.next([...panels]);
    };

    panels.push({
      id: 'button',
      type: 'component',
      gridPos: { x: 12, y: 0, w: 12, h: 1 },
      component: () => <Button onClick={onButtonHit}>Hit me</Button>,
    });

    observer.next(panels);
  });
}
