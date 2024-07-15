import { SelectableValue } from '@grafana/data';
import {
  SceneComponentProps,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
} from '@grafana/scenes';
import { Field, RadioButtonGroup } from '@grafana/ui';

import { reportExploreMetrics } from '../interactions';
import { MakeOptional, TRAIL_BREAKDOWN_VIEW_KEY } from '../shared';

import { BreakdownLayoutType } from './types';

export interface LayoutSwitcherState extends SceneObjectState {
  breakdownLayout: BreakdownLayoutType;
  layouts: SceneObject[];
  options: Array<SelectableValue<BreakdownLayoutType>>;
}

export class LayoutSwitcher extends SceneObjectBase<LayoutSwitcherState> implements SceneObjectWithUrlSync {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['breakdownLayout'] });

  public constructor(state: MakeOptional<LayoutSwitcherState, 'breakdownLayout'>) {
    super({ ...state, breakdownLayout: state.breakdownLayout ?? 'grid' });
  }

  getUrlState() {
    return { breakdownLayout: this.state.breakdownLayout };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.breakdownLayout === 'string') {
      const newBreakdownLayout = values.breakdownLayout as BreakdownLayoutType;
      if (this.state.breakdownLayout !== newBreakdownLayout) {
        this.setState({ breakdownLayout: newBreakdownLayout });
      }
    }
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
    const { options, breakdownLayout } = this.useState();

    const activeLayout = options.map((option) => option.value).includes(breakdownLayout)
      ? breakdownLayout
      : options[0].value;
    return activeLayout;
  }

  public onLayoutChange = (breakdownLayout: BreakdownLayoutType) => {
    reportExploreMetrics('breakdown_layout_changed', { layout: breakdownLayout });
    localStorage.setItem(TRAIL_BREAKDOWN_VIEW_KEY, breakdownLayout);
    this.setState({ breakdownLayout });
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
