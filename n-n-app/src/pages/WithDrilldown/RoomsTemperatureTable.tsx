import { PanelBuilders, SceneDataTransformer } from '@grafana/scenes';
import { TableCellBackgroundDisplayMode, TableCellDisplayMode, ThresholdsMode } from '@grafana/schema';

export function RoomsTemperatureTable() {
  const data = new SceneDataTransformer({
    transformations: [
      {
        id: 'reduce',
        options: {
          reducers: ['mean'],
        },
      },
      {
        id: 'organize',
        options: {
          excludeByName: {},
          indexByName: {},
          renameByName: {
            Field: 'Room',
            Mean: 'Average temperature',
          },
        },
      },
    ],
  });
  return PanelBuilders.table()
    .setTitle('Room temperature overview')
    .setData(data)
    .setHoverHeader(true)
    .setDisplayMode('transparent')
    .setOption('sortBy', [{ displayName: 'Average temperature' }])
    .setThresholds({
      mode: ThresholdsMode.Absolute,
      steps: [
        {
          color: 'light-blue',
          value: 0,
        },
        {
          color: 'orange',
          value: 19,
        },
        {
          color: 'dark-red',
          value: 26,
        },
      ],
    })
    .setColor({ mode: 'thresholds' })
    .setCustomFieldConfig('align', 'auto')
    .setCustomFieldConfig('cellOptions', { type: TableCellDisplayMode.Auto })
    .setCustomFieldConfig('inspect', false)
    .setOverrides((b) =>
      b
        .matchFieldsWithName('Average temperature')
        .overrideUnit('celsius')
        .overrideCustomFieldConfig('cellOptions', {
          type: TableCellDisplayMode.ColorBackground,
          mode: TableCellBackgroundDisplayMode.Basic,
        })
        .overrideCustomFieldConfig('width', 200)
        .overrideCustomFieldConfig('align', 'center')
        .matchFieldsWithName('Room')
        .overrideLinks([
          { title: 'Go to room overview', url: '${__url.path}/room/${__value.text}/temperature${__url.params}' },
        ])
    )
    .build();
}
