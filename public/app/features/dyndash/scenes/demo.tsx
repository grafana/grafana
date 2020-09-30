import React from 'react';
import { CoreApp, DataQueryRequest, dateMath, LoadingState, PanelData, TimeRange } from '@grafana/data';
import { Button } from '@grafana/ui';
import { Observable, of, Subscription } from 'rxjs';
import { Scene, SceneItem, SceneItemList, ScenePanel, VizPanel } from '../models';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { runRequest } from 'app/features/dashboard/state/runRequest';
import { map, mergeMap } from 'rxjs/operators';
import { v4 as newUuid } from 'uuid';

export function getDemoScene(name: string): Observable<Scene> {
  return new Observable<Scene>(observer => {
    const scene: Scene = {
      title: `Demo ${name}`,
      panels: [],
    };

    const onButtonHit = () => {
      scene.panels.push(getDemoPanel());
      observer.next(scene);
    };

    // const onAddNested = () => {
    //   panels.push(
    //     of({
    //       id: newUuid(),
    //       title: 'inner scene',
    //       type: 'scene',
    //       gridPos: { x: 12, y: 1, w: 12, h: 1 },
    //       panels: getDemoPanels(),
    //     })
    //   );
    //   observer.next(panels);
    // };

    scene.panels.push(getDemoPanel());

    // panels.push(
    //   of({
    //     id: 'button3',
    //     type: 'component',
    //     gridPos: { x: 12, y: 1, w: 12, h: 1 },
    //     component: () => <Button onClick={onAddNested}>Add nested scene</Button>,
    //   })
    // );

    observer.next(scene);
  });

  // return new Observable<SceneItemList>(observer => {
  //   const panels: SceneItem[] = [];

  //   const onButtonHit = () => {
  //     panels.push({
  //       id: panels.length.toString(),
  //       type: 'scene',
  //       title: 'Nested scene',
  //       gridPos: { x: 0, y: 3, w: 12, h: 10 },
  //       panels: getDemoScene('nested').pipe(mergeMap(scene => scene.panels)),
  //     });
  //     observer.next([...panels]);
  //   };

  //   const onQuery = () => {
  //     panels.push({
  //       id: 'nestedScene',
  //       type: 'scene',
  //       title: 'Query scene',
  //       gridPos: { x: 0, y: 3, w: 12, h: 10 },
  //       panels: getQueryPanels(),
  //     });
  //     observer.next([...panels]);
  //   };

  //   panels.push({
  //     id: 'A',
  //     type: 'viz',
  //     title: 'Demo panel',
  //     vizId: 'bar-gauge',
  //     gridPos: { x: 0, y: 0, w: 12, h: 3 },
  //     data: of({
  //       state: LoadingState.Done,
  //       series: [],
  //       timeRange: {} as TimeRange,
  //     } as PanelData),
  //   });

  //   panels.push({
  //     id: 'button',
  //     type: 'component',
  //     gridPos: { x: 12, y: 0, w: 12, h: 1 },
  //     component: () => <Button onClick={onButtonHit}>Hit me</Button>,
  //   });

  //   panels.push({
  //     id: 'button2',
  //     type: 'component',
  //     gridPos: { x: 12, y: 1, w: 12, h: 1 },
  //     component: () => <Button onClick={onQuery}>Query stuff</Button>,
  //   });

  //   observer.next(panels);
  // });
}

function getDemoPanel(): Observable<SceneItem> {
  return new Observable<SceneItem>(observer => {
    let counter = 1;

    const panel: VizPanel = {
      id: newUuid(),
      type: 'viz',
      title: 'Demo panel',
      vizId: 'bar-gauge',
      gridPos: { x: 0, y: 0, w: 12, h: 3 },
      data: of({
        state: LoadingState.Done,
        series: [],
        timeRange: {} as TimeRange,
      } as PanelData),
    };

    setInterval(() => {
      observer.next({
        ...panel,
        title: 'Demo panel ' + counter++,
      });
    }, 2000);

    observer.next(panel);
  });
}

function getQueryPanels(): Observable<SceneItem[]> {
  return getDemoData().pipe(
    map(data => {
      return data.series.map((series, index) => {
        return {
          id: `data-${index}`,
          type: 'viz',
          title: series.name,
          gridPos: { x: 0, y: index, w: 24, h: 1 },
        } as VizPanel;
      });
    })
  );
}

function getDemoData(): Observable<PanelData> {
  return new Observable<PanelData>(observer => {
    const request: DataQueryRequest = {
      app: CoreApp.Dashboard,
      requestId: 'request',
      timezone: 'browser',
      range: {
        from: dateMath.parse('now-1h', false)!,
        to: dateMath.parse('now', false)!,
        raw: { from: 'now-1h', to: 'now' },
      },
      interval: '10s',
      intervalMs: 1000,
      targets: [
        {
          alias: '__house_locations',
          refId: 'A',
          scenarioId: 'random_walk',
          seriesCount: 5,
        } as any,
      ],
      maxDataPoints: 500,
      scopedVars: {},
      startTime: Date.now(),
    };

    const subscription = new Subscription();

    getDatasourceSrv()
      .get('gdev-testdata')
      .then(ds => {
        subscription.add(runRequest(ds, request).subscribe(observer));
      });

    return subscription;
  });
}
