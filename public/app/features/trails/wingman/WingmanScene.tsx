import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
} from '@grafana/scenes';
import { RadioButtonList } from '@grafana/ui';

import { WMDisplayChangeEvent } from '../shared';

import { isWingmanGroupKey, useWingmanOptionGroup, WingmanGroupKeyType } from './wingman';

type WingmanGroupKeyInState = {
  [key in WingmanGroupKeyType]: string;
};

interface WingmanSceneState extends SceneObjectState, WingmanGroupKeyInState {}

export class WingmanScene extends SceneObjectBase<WingmanSceneState> implements SceneObjectWithUrlSync {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['wm_display_view', 'wm_group_by', 'wm_sort_by'],
  });

  constructor(state: Partial<WingmanSceneState>) {
    super({
      wm_display_view: state.wm_display_view ?? 'default',
      wm_group_by: state.wm_group_by ?? 'none',
      wm_sort_by: state.wm_sort_by ?? 'alphabetical_az',
    });
  }

  getUrlState(): SceneObjectUrlValues {
    const { wm_sort_by, wm_display_view, wm_group_by } = this.state;
    return { wm_sort_by, wm_display_view, wm_group_by };
  }

  // For some reason this isn't triggered. So we will rely on events instead.
  updateFromUrl(values: SceneObjectUrlValues): void {
    const urlState = this._urlSync.getKeys().reduce<Partial<WingmanGroupKeyInState>>((prev, key) => {
      const val = values[key];
      if (typeof val === 'string' && isWingmanGroupKey(key)) {
        prev[key] = val;
      }
      return prev;
    }, {});

    this.setState({ ...urlState });
  }

  onWingmanOptionChanged = (groupId: string, value: string) => {
    this.setState({[groupId]: value});
    this.publishEvent(new WMDisplayChangeEvent({groupId, value}), true);
  };

  public static Component = ({ model }: SceneComponentProps<WingmanScene>) => {
    const state = model.useState();
    const { onWingmanOptionChanged } = model;
    const initialData = useWingmanOptionGroup();
    return (
      <div>
        <div>11241 Metrics</div>
        {initialData.map((group, groupIdx) => (
          <div key={group.title}>
            <h2>{group.title}</h2>
            <RadioButtonList<string>
              name={group.title + '---name'}
              value={state[group.id]}
              disabledOptions={group.options.filter((opt) => !opt.available).map((op) => op.id)}
              options={group.options.map((opt) => ({ label: opt.label, value: opt.id }))}
              onChange={(val) => onWingmanOptionChanged(group.id, val)}
            />
          </div>
        ))}
      </div>
    );
  };
}
