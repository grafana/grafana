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

import { isBreakdownLayoutType, BreakdownLayoutChangeCallback, BreakdownLayoutType } from './types';

export interface LayoutSwitcherState extends SceneObjectState {
  activeBreakdownLayout: BreakdownLayoutType;
  breakdownLayouts: SceneObject[];
  breakdownLayoutOptions: Array<SelectableValue<BreakdownLayoutType>>;
  onBreakdownLayoutChange: BreakdownLayoutChangeCallback;
}

export class LayoutSwitcher extends SceneObjectBase<LayoutSwitcherState> implements SceneObjectWithUrlSync {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['breakdownLayout'] });

  public constructor(state: MakeOptional<LayoutSwitcherState, 'activeBreakdownLayout'>) {
    const storedBreakdownLayout = localStorage.getItem(TRAIL_BREAKDOWN_VIEW_KEY);
    super({
      activeBreakdownLayout: isBreakdownLayoutType(storedBreakdownLayout) ? storedBreakdownLayout : 'grid',
      ...state,
    });
  }

  getUrlState() {
    return { breakdownLayout: this.state.activeBreakdownLayout };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const newBreakdownLayout = values.breakdownLayout;
    if (newBreakdownLayout === 'string' && isBreakdownLayoutType(newBreakdownLayout)) {
      if (this.state.activeBreakdownLayout !== newBreakdownLayout) {
        this.setState({ activeBreakdownLayout: newBreakdownLayout });
      }
    }
  }

  public Selector({ model }: { model: LayoutSwitcher }) {
    const { activeBreakdownLayout, breakdownLayoutOptions } = model.useState();

    return (
      <Field label="View">
        <RadioButtonGroup
          options={breakdownLayoutOptions}
          value={activeBreakdownLayout}
          onChange={model.onLayoutChange}
        />
      </Field>
    );
  }

  public onLayoutChange = (active: BreakdownLayoutType) => {
    if (this.state.activeBreakdownLayout === active) {
      return;
    }

    reportExploreMetrics('breakdown_layout_changed', { layout: active });
    localStorage.setItem(TRAIL_BREAKDOWN_VIEW_KEY, active);
    this.setState({ activeBreakdownLayout: active });
    this.state.onBreakdownLayoutChange(active);
  };

  public static Component = ({ model }: SceneComponentProps<LayoutSwitcher>) => {
    const { breakdownLayouts, breakdownLayoutOptions, activeBreakdownLayout } = model.useState();

    const index = breakdownLayoutOptions.findIndex((o) => o.value === activeBreakdownLayout);
    if (index === -1) {
      return null;
    }

    const layout = breakdownLayouts[index];

    return <layout.Component model={layout} />;
  };
}
