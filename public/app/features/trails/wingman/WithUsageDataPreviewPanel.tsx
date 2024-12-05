import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Icon, useStyles2 } from '@grafana/ui';

interface WithUsageDataPreviewPanelState extends SceneObjectState {
  vizPanelInGridItem?: VizPanel;
}

export class WithUsageDataPreviewPanel extends SceneObjectBase<WithUsageDataPreviewPanelState> {
  constructor(state: Partial<WithUsageDataPreviewPanelState>) {
    super(state);
  }

  public static Component = ({ model }: SceneComponentProps<WithUsageDataPreviewPanel>) => {
    const { vizPanelInGridItem } = model.useState();
    if (!vizPanelInGridItem) {
      console.log('no viz panel');
      return;
    }

    const styles = useStyles2(getStyles);

    return (
      <div className={styles.panelContainer}>
        <vizPanelInGridItem.Component model={vizPanelInGridItem} />
        <div className={styles.usageContainer}>
          <span className={styles.usageItem}>
            <Icon name="apps" /> 16
          </span>
          <span className={styles.usageItem}>
            <Icon name="bell" /> 16
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
