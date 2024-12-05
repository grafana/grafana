import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Icon, useStyles2 } from '@grafana/ui';

import { UsageStats } from '../shared';
import { getTrailFor } from '../utils';

interface WithUsageDataPreviewPanelState extends SceneObjectState {
  vizPanelInGridItem: VizPanel;
  metric: string;
  stats?: UsageStats;
}

export class WithUsageDataPreviewPanel extends SceneObjectBase<WithUsageDataPreviewPanelState> {
  constructor(state: WithUsageDataPreviewPanelState) {
    super({ ...state });
  }

  public static Component = ({ model }: SceneComponentProps<WithUsageDataPreviewPanel>) => {
    const { vizPanelInGridItem, metric } = model.useState();
    if (!vizPanelInGridItem) {
      console.log('no viz panel');
      return;
    }

    const styles = useStyles2(getStyles);
    const trails = getTrailFor(model);
    const { usageStats } = trails.useState();

    return (
      <div className={styles.panelContainer}>
        <vizPanelInGridItem.Component model={vizPanelInGridItem} />
        <div className={styles.usageContainer}>
          <span className={styles.usageItem}>
            <Icon name="apps" /> {usageStats.dashboards[metric] ?? 0}
          </span>
          <span className={styles.usageItem}>
            <Icon name="bell" /> {usageStats.alertRules[metric] ?? 0}
          </span>
        </div>
      </div>
    );
  };
}

export function getStyles(theme: GrafanaTheme2) {
  return {
    panelContainer: css({
      height: '175px',
    }),
    usageContainer: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      gap: '10px',
      padding: '8px 16px',
      border: '1px solid #4e4c4c',
      borderTopWidth: 0,
      backgroundColor: '#181B1F',
      alignItems: 'center',
    }),
    usageItem: css({
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }),
  };
}
