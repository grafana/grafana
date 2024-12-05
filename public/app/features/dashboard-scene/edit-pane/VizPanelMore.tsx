import { IconName } from '@grafana/data';

import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, Stack, Toggletip, ToolbarButton } from '@grafana/ui';

export interface AlternativeActions {
  name: string;
  icon?: IconName;
  onClick?: () => void;
}

interface VizPanelMoreState extends SceneObjectState {
  actions: AlternativeActions[];
}

export class VizPanelMore extends SceneObjectBase<VizPanelMoreState> {
  static Component = VizPanelMoreRenderer;
}

function VizPanelMoreRenderer({ model }: SceneComponentProps<VizPanelMore>) {
  const { actions } = model.useState();
  sceneGraph.getTimeRange(model).useState();
  return (
    <Toggletip
      title={<h3>Panel added</h3>}
      fitContent={true}
      content={
        <>
          <p>We've added a table panel with the data. Is there anything else you'd like to explore or customize?</p>
          <Stack gap={3}>
            {actions.map((item, idx) => (
              <Button size="sm" key={idx} variant="secondary" icon={item.icon} onClick={item.onClick}>
                {item.name}
              </Button>
            ))}
          </Stack>
        </>
      }
    >
      <ToolbarButton variant="primary">More</ToolbarButton>
    </Toggletip>
  );
}
