import { SelectableValue } from '@grafana/data';
import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Field, RadioButtonGroup } from '@grafana/ui';

import { reportExploreMetrics } from '../interactions';
import { MakeOptional, TRAIL_BREAKDOWN_VIEW_KEY } from '../shared';

import { BreakdownLayoutType } from './types';

export interface LayoutSwitcherState extends SceneObjectState {
  layouts: SceneObject[];
  options: Array<SelectableValue<BreakdownLayoutType>>;
  breakdownLayout: BreakdownLayoutType;
  onBreakdownLayoutChange?: (val: BreakdownLayoutType) => void;
}

export class LayoutSwitcher extends SceneObjectBase<LayoutSwitcherState> {
  public constructor(state: MakeOptional<LayoutSwitcherState, 'breakdownLayout'>) {
    super({ ...state, breakdownLayout: state.breakdownLayout ?? 'grid' });
  }

  public Selector({ model }: { model: LayoutSwitcher }) {
    const { options, breakdownLayout } = model.useState();
    const index = options.findIndex((o) => o.value === breakdownLayout);
    const selectedValue = index === -1 ? 'grid' : breakdownLayout;

    return (
      <Field label="View">
        <RadioButtonGroup options={options} value={selectedValue} onChange={model.onLayoutChange} />
      </Field>
    );
  }

  public onLayoutChange = (breakdownLayout: BreakdownLayoutType) => {
    reportExploreMetrics('breakdown_layout_changed', { layout: breakdownLayout });
    localStorage.setItem(TRAIL_BREAKDOWN_VIEW_KEY, breakdownLayout);
    this.state.onBreakdownLayoutChange?.(breakdownLayout);
  };

  public static Component = ({ model }: SceneComponentProps<LayoutSwitcher>) => {
    const { layouts, options, breakdownLayout } = model.useState();

    const index = options.findIndex((o) => o.value === breakdownLayout);
    const layout = index === -1 ? layouts[0] : layouts[index];

    return <layout.Component model={layout} />;
  };
}
