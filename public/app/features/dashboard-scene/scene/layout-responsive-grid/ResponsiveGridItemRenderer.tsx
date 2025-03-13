import { SceneComponentProps } from '@grafana/scenes';

import { ResponsiveGridItem } from './ResponsiveGridItem';

export interface ResponsiveGridItemProps extends SceneComponentProps<ResponsiveGridItem> {}

export function ResponsiveGridItemRenderer({ model }: ResponsiveGridItemProps) {
  const { body } = model.useState();

  return model.state.repeatedPanels ? (
    <>
      {model.state.repeatedPanels.map((item) => (
        <item.Component model={item} key={item.state.key} />
      ))}
    </>
  ) : (
    <body.Component model={body} />
  );
}
