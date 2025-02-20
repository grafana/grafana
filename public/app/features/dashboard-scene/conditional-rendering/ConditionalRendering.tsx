import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { ConditionalRenderingGroup } from './ConditionalRenderingGroup';

export interface ConditionalRenderingState extends SceneObjectState {
  rootGroup: ConditionalRenderingGroup;
}

export class ConditionalRendering extends SceneObjectBase<ConditionalRenderingState> {
  public static Component = ConditionalRenderingRenderer;

  public evaluate(): boolean {
    return this.state.rootGroup.evaluate();
  }

  public notifyChange() {
    this.parent?.forceRender();
  }

  public static createEmpty(): ConditionalRendering {
    return new ConditionalRendering({ rootGroup: ConditionalRenderingGroup.createEmpty() });
  }
}

function ConditionalRenderingRenderer({ model }: SceneComponentProps<ConditionalRendering>) {
  const { rootGroup } = model.useState();

  return <rootGroup.Component model={rootGroup} />;
}
