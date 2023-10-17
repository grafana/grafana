import React from 'react';

import { SelectableValue } from '@grafana/data';
import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Field, RadioButtonGroup } from '@grafana/ui';

export interface LayoutSwitcherState extends SceneObjectState {
  active: LayoutType;
  single: SceneObject;
  grid: SceneObject;
  rows: SceneObject;
}

export type LayoutType = 'single' | 'grid' | 'rows';

export class LayoutSwitcher extends SceneObjectBase<LayoutSwitcherState> {
  public Selector({ model }: { model: LayoutSwitcher }) {
    const { active } = model.useState();
    const radioOptions: Array<SelectableValue<LayoutType>> = [
      { value: 'single', label: 'Single' },
      { value: 'grid', label: 'Grid' },
      { value: 'rows', label: 'Rows' },
    ];

    return (
      <Field label="View">
        <RadioButtonGroup options={radioOptions} value={active} onChange={model.onLayoutChange} />
      </Field>
    );
  }

  public onLayoutChange = (active: LayoutType) => {
    this.setState({ active });
  };

  public static Component = ({ model }: SceneComponentProps<LayoutSwitcher>) => {
    const { single, grid, rows, active } = model.useState();

    switch (active) {
      case 'grid':
        return <grid.Component model={grid} />;
      case 'rows':
        return <rows.Component model={rows} />;
      case 'single':
      default:
        return <single.Component model={single} />;
    }
  };
}
