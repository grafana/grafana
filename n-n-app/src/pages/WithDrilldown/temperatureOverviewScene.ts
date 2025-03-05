import { ReducerID } from '@grafana/data';
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
import { RoomTemperatureStat } from './RoomTemperatureStat';

export function temperatureOverviewScene(roomName: string) {
  return new EmbeddedScene({
    $timeRange: new SceneTimeRange({
      from: 'now-12h',
      to: 'now',
    }),
    $data: new SceneQueryRunner({
      datasource: DATASOURCE_REF,
      queries: [getRoomTemperatureQuery(roomName)],
      maxDataPoints: 100,
    }),
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          height: 500,
          body: PanelBuilders.timeseries().setTitle('Temperature over time').setUnit('celsius').build(),
        }),
        new SceneFlexItem({
          body: new SceneFlexLayout({
            direction: 'row',
            children: [
              new SceneFlexItem({
                body: RoomTemperatureStat([ReducerID.min]),
              }),
              new SceneFlexItem({
                body: RoomTemperatureStat([ReducerID.max]),
              }),
              new SceneFlexItem({
                body: RoomTemperatureStat([ReducerID.mean]),
              }),
            ],
          }),
        }),
      ],
    }),
    controls: [new SceneControlsSpacer(), new SceneTimePicker({ isOnCanvas: true }), new SceneRefreshPicker({})],
  });
}

function getRoomTemperatureQuery(roomName: string) {
  return {
    refId: 'Temp',
    datasource: DATASOURCE_REF,
    scenarioId: 'random_walk',
    seriesCount: 1,
    alias: roomName,
    min: 10,
    max: 30,
  };
}
