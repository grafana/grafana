import {
  EmbeddedScene,
  PanelBuilders,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
} from '@grafana/scenes';
import { DATASOURCE_REF } from '../../constants';

export function humidityOverviewScene(roomName: string) {
  return new EmbeddedScene({
    $timeRange: new SceneTimeRange({
      from: 'now-12h',
      to: 'now',
    }),
    $data: new SceneQueryRunner({
      datasource: DATASOURCE_REF,
      queries: [getRoomHumidityQuery(roomName)],
      maxDataPoints: 100,
    }),
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          height: 500,
          body: PanelBuilders.timeseries().setTitle('Humidity over time').setUnit('humidity').build(),
        }),
      ],
    }),
    controls: [new SceneControlsSpacer(), new SceneTimePicker({ isOnCanvas: true }), new SceneRefreshPicker({})],
  });
}

function getRoomHumidityQuery(roomName: string) {
  return {
    refId: 'Humidity',
    datasource: DATASOURCE_REF,
    scenarioId: 'random_walk',
    seriesCount: 1,
    alias: roomName,
    min: 30,
    max: 60,
  };
}
