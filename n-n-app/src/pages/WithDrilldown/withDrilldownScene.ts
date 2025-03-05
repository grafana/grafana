import { EmbeddedScene, SceneFlexItem, SceneFlexLayout, SceneQueryRunner } from '@grafana/scenes';
import { DATASOURCE_REF } from '../../constants';
import { RoomsTemperatureTable } from './RoomsTemperatureTable';
import { RoomsTemperatureStat } from './RoomsTemperatureStat';

const roomsTemperatureQuery = {
  refId: 'Rooms temperature',
  datasource: DATASOURCE_REF,
  scenarioId: 'random_walk',
  seriesCount: 8,
  alias: '__house_locations',
  min: 10,
  max: 27,
};

export function withDrilldownScene() {
  return new EmbeddedScene({
    $data: new SceneQueryRunner({
      datasource: DATASOURCE_REF,
      queries: [roomsTemperatureQuery],
      maxDataPoints: 100,
    }),

    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          height: 300,
          body: RoomsTemperatureTable(),
        }),
        new SceneFlexItem({
          ySizing: 'fill',
          body: RoomsTemperatureStat(),
        }),
      ],
    }),
  });
}
