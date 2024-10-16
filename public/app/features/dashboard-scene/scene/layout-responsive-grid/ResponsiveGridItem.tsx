import { SceneObjectState, VizPanel, SceneObjectBase, SceneObject, SceneComponentProps } from '@grafana/scenes';
import { Switch } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

export interface ResponsiveGridItemState extends SceneObjectState {
  body: VizPanel;
  hideWhenNoData?: boolean;
}

export class ResponsiveGridItem extends SceneObjectBase<ResponsiveGridItemState> {
  public constructor(state: ResponsiveGridItemState) {
    super(state);
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    if (!this.state.hideWhenNoData) {
      return;
    }

    // TODO add hide when no data logic (in a behavior probably)
  }

  public toggleHideWhenNoData() {
    this.setState({ hideWhenNoData: !this.state.hideWhenNoData });
  }

  /**
   * DashboardLayoutElement interface
   */
  public isDashboardLayoutElement: true = true;

  public getOptions?(): OptionsPaneItemDescriptor[] {
    const model = this;

    return [
      new OptionsPaneItemDescriptor({
        title: 'Hide when no data',
        render: function renderTransparent() {
          const { hideWhenNoData } = model.state;
          return <Switch value={hideWhenNoData} id="hide-when-no-data" onChange={() => model.toggleHideWhenNoData()} />;
        },
      }),
    ];
  }

  public setBody(body: SceneObject): void {
    if (body instanceof VizPanel) {
      this.setState({ body });
    }
  }

  public getVizPanel() {
    return this.state.body;
  }

  public static Component = ({ model }: SceneComponentProps<ResponsiveGridItem>) => {
    const { body } = model.useState();

    return <body.Component model={body} />;
  };
}
