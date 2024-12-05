import { IconName } from '@grafana/data';

import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, Stack, Toggletip, ToolbarButton } from '@grafana/ui';

interface VizPanelMoreState extends SceneObjectState {
  onClick?: () => void;
}

export class VizPanelDelete extends SceneObjectBase<VizPanelMoreState> {
  static Component = VizPanelDeleteRenderer;
}

function VizPanelDeleteRenderer({ model }: SceneComponentProps<VizPanelDelete>) {
  const { onClick } = model.useState();
  return <ToolbarButton icon="trash-alt" onClick={onClick} />;
}
