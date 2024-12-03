import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
} from '@grafana/scenes';
import { RadioButtonList, useStyles2 } from '@grafana/ui';

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
    this.setState({ [groupId]: value });
  };

  public static Component = ({ model }: SceneComponentProps<WingmanScene>) => {
    const styles = useStyles2(getStyles);
    const state = model.useState();
    const { onWingmanOptionChanged } = model;
    const initialData = useWingmanOptionGroup();
    return (
      <div className={styles.vertialLine}>
        <div className={styles.title}>11241 Metrics</div>
        {initialData.map((group, groupIdx) => (
          <div key={group.title}>
            <div className={styles.horizontalLine} />
            <h2 className={styles.title}>{group.title}</h2>
            <div className={styles.label}>
              <RadioButtonList<string>
                name={group.title + '---name'}
                value={state[group.id]}
                disabledOptions={group.options.filter((opt) => !opt.available).map((op) => op.id)}
                options={group.options.map((opt) => ({ label: opt.label, value: opt.id }))}
                onChange={(val) => onWingmanOptionChanged(group.id, val)}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };
}

export function getStyles(theme: GrafanaTheme2) {
  return {
    vertialLine: css({
      borderRight: `1px solid var(--border-Weak, rgba(204, 204, 220, 0.12))`,
      height: '540px',
    }),
    title: css({
      overflow: 'hidden',
      color: '#FFF',
      textOverflow: 'ellipsis',
      fontSize: '14px', // should be 12px but making 14px to match the label font size
      fontWeight: 500,
      lineHeight: '18px' /* 150% */,
      letterSpacing: '0.018px',
    }),
    label: css({
      fontSize: '12px', // not being properly applied, currently is 14px
      color: 'theme.colors.text.primary',
      fontWeight: 400,
      // lineHeight: '18px',
      letterSpacing: '0.018px',
    }),
    horizontalLine: css({
      width: '154px',
      height: '1px',
      background: theme.colors.border.weak,
      marginTop: '8px',
      marginBottom: '8px',
    }),
  };
}
