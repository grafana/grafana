import { SelectableValue } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Field, RadioButtonGroup } from '@grafana/ui';

import { MetricScene } from '../MetricScene';
import { reportExploreMetrics } from '../interactions';

import { LayoutType } from './types';

export interface LayoutSwitcherState extends SceneObjectState {
  layouts: SceneObject[];
  options: Array<SelectableValue<LayoutType>>;
}

export class LayoutSwitcher extends SceneObjectBase<LayoutSwitcherState> {
  private getMetricScene() {
    return sceneGraph.getAncestor(this, MetricScene);
  }

  public Selector({ model }: { model: LayoutSwitcher }) {
    const { options } = model.useState();
    const activeLayout = model.useActiveLayout();

    return (
      <Field label="View">
        <RadioButtonGroup options={options} value={activeLayout} onChange={model.onLayoutChange} />
      </Field>
    );
  }

  private useActiveLayout() {
    const { options } = this.useState();
    const { layout } = this.getMetricScene().useState();

    const activeLayout = options.map((option) => option.value).includes(layout) ? layout : options[0].value;
    return activeLayout;
  }

  public onLayoutChange = (layout: LayoutType) => {
    reportExploreMetrics('breakdown_layout_changed', { layout });
    this.getMetricScene().setState({ layout });
  };

  public static Component = ({ model }: SceneComponentProps<LayoutSwitcher>) => {
    const { layouts, options } = model.useState();
    const activeLayout = model.useActiveLayout();

    const index = options.findIndex((o) => o.value === activeLayout);
    if (index === -1) {
      return null;
    }

    const layout = layouts[index];

    return <layout.Component model={layout} />;
  };
}
