import { BusEventBase, SelectableValue } from '@grafana/data';
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

import { isLayoutType, LayoutChangeCallback, LayoutType } from './types';

export interface LayoutSwitcherState extends SceneObjectState {
  active: LayoutType;
  layouts: SceneObject[];
  options: Array<SelectableValue<LayoutType>>;
  onLayoutChange: LayoutChangeCallback;
}

export class LayoutSwitcher extends SceneObjectBase<LayoutSwitcherState> implements SceneObjectWithUrlSync {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['layout'] });

  public constructor(state: MakeOptional<LayoutSwitcherState, 'active'>) {
    const layout = localStorage.getItem(TRAIL_BREAKDOWN_VIEW_KEY);
    super({
      active: isLayoutType(layout) ? layout : 'grid',
      ...state,
    });
  }

  getUrlState() {
    return { layout: this.state.active };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.layout === 'string') {
      const newLayout = values.layout as LayoutType;
      if (this.state.active !== newLayout) {
        this.setState({ active: newLayout });
      }
    }
  }

  public Selector({ model }: { model: LayoutSwitcher }) {
    const { active, options } = model.useState();

    return (
      <Field label="View">
        <RadioButtonGroup options={options} value={active} onChange={model.onLayoutChange} />
      </Field>
    );
  }

  public onLayoutChange = (active: LayoutType) => {
    if (this.state.active === active) {
      return;
    }

    reportExploreMetrics('breakdown_layout_changed', { layout: active });
    localStorage.setItem(TRAIL_BREAKDOWN_VIEW_KEY, active);
    this.setState({ active });
    this.state.onLayoutChange(active);
  };

  public static Component = ({ model }: SceneComponentProps<LayoutSwitcher>) => {
    const { layouts, options, active } = model.useState();

    const index = options.findIndex((o) => o.value === active);
    if (index === -1) {
      return null;
    }

    const layout = layouts[index];

    return <layout.Component model={layout} />;
  };
}
