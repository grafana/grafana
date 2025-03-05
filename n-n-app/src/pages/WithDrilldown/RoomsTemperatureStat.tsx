import { PanelBuilders, SceneByFrameRepeater, SceneDataNode, SceneFlexItem, SceneFlexLayout } from '@grafana/scenes';

export function RoomsTemperatureStat() {
  const stat = PanelBuilders.stat()
    .setUnit('celsius')
    .setLinks([
      {
        title: 'Go to room temperature overview',
        url: '${__url.path}/room/${__field.name}/temperature${__url.params}',
      },
      {
        title: 'Go to room humidity overview',
        url: '${__url.path}/room/${__field.name}/humidity${__url.params}',
      },
    ]);

  return new SceneByFrameRepeater({
    body: new SceneFlexLayout({
      direction: 'row',
      wrap: 'wrap',
      children: [],
    }),
    getLayoutChild: (data, frame) => {
      return new SceneFlexItem({
        height: '50%',
        minWidth: '20%',
        body: stat
          .setTitle(frame.name || '')
          .setData(
            new SceneDataNode({
              data: {
                ...data,
                series: [frame],
              },
            })
          )
          .build(),
      });
    },
  });
}
