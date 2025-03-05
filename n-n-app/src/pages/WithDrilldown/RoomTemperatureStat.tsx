import { ReducerID } from '@grafana/data';
import { PanelBuilders, SceneDataTransformer } from '@grafana/scenes';

export function RoomTemperatureStat(reducers: ReducerID[]) {
  const data = new SceneDataTransformer({
    transformations: [
      {
        id: 'reduce',
        options: {
          reducers,
        },
      },
    ],
  });
  return PanelBuilders.stat().setData(data).setUnit('celsius').build();
}
