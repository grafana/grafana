import { SceneObjectState, SceneObjectBase, SceneComponentProps } from '@grafana/scenes';

import { DashboardLayoutManager, LayoutParent } from '../types';

export interface RowItemState extends SceneObjectState {
  layout: DashboardLayoutManager;
  title?: string;
}

export class RowItem extends SceneObjectBase<RowItemState> implements LayoutParent {
  public switchLayout(layout: DashboardLayoutManager): void {
    this.setState({ layout });
  }
  public static Component = ({ model }: SceneComponentProps<RowItem>) => {
    const { layout } = model.useState();

    return <layout.Component model={layout} />;
  };
}
