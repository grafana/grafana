import {
  SceneObjectState,
  VizPanel,
  SceneObjectBase,
  SceneVariableSet,
  SceneObject,
  SceneComponentProps,
} from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

export interface ResponsiveGridItemState extends SceneObjectState {
  body: VizPanel;
}

export class ResponsiveGridItem extends SceneObjectBase<ResponsiveGridItemState> {
  /**
   * DashboardLayoutElement interface
   */
  public isDashboardLayoutElement: true = true;

  public getOptions?(): OptionsPaneItemDescriptor[] {
    return [];
  }

  public getVariableScope?(): SceneVariableSet | undefined {
    return undefined;
  }

  public setBody(body: SceneObject): void {
    if (body instanceof VizPanel) {
      this.setState({ body });
    }
  }

  public static Component = ({ model }: SceneComponentProps<ResponsiveGridItem>) => {
    const { body } = model.useState();

    return <body.Component model={body} />;
  };
}
