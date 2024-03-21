import React from 'react';

import { SelectableValue } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Field, RadioButtonGroup } from '@grafana/ui';

import { MetricScene } from '../MetricScene';

export interface LayoutSwitcherState extends SceneObjectState {
  layouts: SceneObject[];
  options: Array<SelectableValue<LayoutType>>;
}

export type LayoutType = 'single' | 'grid' | 'rows';

export class LayoutSwitcher extends SceneObjectBase<LayoutSwitcherState> {
  private getMetricScene() {
    return sceneGraph.getAncestor(this, MetricScene);
  }

  public Selector({ model }: { model: LayoutSwitcher }) {
    const { options } = model.useState();
    const { layout } = model.getMetricScene().useState();

    return (
      <Field label="View">
        <RadioButtonGroup options={options} value={layout} onChange={model.onLayoutChange} />
      </Field>
    );
  }

  public onLayoutChange = (active: LayoutType) => {
    this.getMetricScene().setState({ layout: active });
  };

  public static Component = ({ model }: SceneComponentProps<LayoutSwitcher>) => {
    const { layouts, options } = model.useState();
    const { layout: activeLayout } = model.getMetricScene().useState();

    const index = options.findIndex((o) => o.value === activeLayout);
    if (index === -1) {
      return null;
    }

    const layout = layouts[index];

    return <layout.Component model={layout} />;
  };
}
