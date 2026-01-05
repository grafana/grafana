import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Sidebar, Text, useStyles2 } from '@grafana/ui';
import addPanelImg from 'img/dashboards/add-panel.png';


export function DashboardSidePaneNew({ onAddPanel }: {onAddPanel: () => void}) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.sidePanel}>
      <Sidebar.PaneHeader title={t('dashboard.add.pane-header', 'Add')} />
      <div className={styles.sidePanelContainer}>
        <Text weight="medium">{t('dashboard.add.new-panel.title', 'Panel')}</Text>
        <Text variant="bodySmall">
          {t('dashboard.add.new-panel.description', 'Drag or click to add a panel')}
        </Text>

        <div className={styles.imageContainer}>
          <button className={styles.noStyles} onClick={onAddPanel} aria-label={t('dashboard.add.new-panel.title', 'Panel')}>
            <img alt="Add panel click area" src={addPanelImg} />
          </button>
        </div>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    sidePanel: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    sidePanelContainer: css({
      padding: theme.spacing(2),
      span: {
        display: 'block',
      },
    }),
    imageContainer: css({
        opacity: 0.8,
      padding: theme.spacing(2, 0),
      borderRadius: theme.shape.radius.sm,
      cursor: 'pointer',
      width: '100%',
      '&:hover': {
        opacity: 1,
      }
    }),
    noStyles: css({
      all: 'unset',
    }),
  };
}
