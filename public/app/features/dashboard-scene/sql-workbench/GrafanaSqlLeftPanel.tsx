import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { GrafanaSqlQueryCard } from './GrafanaSqlQueryCard';
import { type GrafanaSqlStructure } from './grafanaSqlParser';

interface Props {
  structure: GrafanaSqlStructure;
}

export function GrafanaSqlLeftPanel({ structure }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.panel}>
      {/* Tabs header */}
      <div className={styles.tabsHeader}>
        <button className={styles.iconBtn}>
          <Icon name="bars" size="sm" />
        </button>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${styles.tabActive}`}>
            <Icon name="database" size="xs" className={styles.tabIcon} />
            Data
          </button>
          <button className={styles.tab}>
            <Icon name="bell" size="xs" className={styles.tabIcon} />
            Alerts (0)
          </button>
        </div>
      </div>

      {/* Scroll area */}
      <div className={styles.scroll}>
        {/* Queries & Expressions section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <button className={styles.sectionToggleBtn}>
              <Icon name="angle-down" size="sm" />
            </button>
            <span className={styles.sectionTitle}>Queries &amp; Expressions</span>
            <button className={styles.addBtn}>
              <Icon name="plus" size="sm" />
            </button>
          </div>

          <div className={styles.queryList}>
            <GrafanaSqlQueryCard structure={structure} isSelected />
          </div>
        </div>

        {/* Transformations section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <button className={styles.sectionToggleBtn}>
              <Icon name="angle-down" size="sm" />
            </button>
            <span className={styles.sectionTitle}>Transformations</span>
            <button className={styles.addBtn}>
              <Icon name="plus" size="sm" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.footerCount}>1 items</span>
        <div className={styles.footerActions}>
          <span className={styles.footerStat}>
            <Icon name="eye" size="sm" className={styles.footerIcon} />1
          </span>
          <span className={styles.footerStat}>
            <Icon name="link" size="sm" className={styles.footerIcon} />0
          </span>
        </div>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    panel: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: '#181b1f',
      border: '1px solid rgba(204,204,220,0.12)',
      borderRadius: 6,
    }),
    tabsHeader: css({
      display: 'flex',
      alignItems: 'center',
      height: 40,
      background: '#22252b',
      borderRadius: '6px 6px 0 0',
      padding: '4px 12px',
      gap: 8,
      flexShrink: 0,
    }),
    iconBtn: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 14,
      height: 14,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: '#ccccdc',
      padding: 0,
      flexShrink: 0,
    }),
    tabs: css({
      display: 'flex',
      alignItems: 'center',
      background: '#111217',
      borderRadius: 6,
      height: 30,
      padding: 2,
      gap: 0,
    }),
    tab: css({
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      height: 26,
      padding: '0 10px',
      borderRadius: 6,
      border: 'none',
      cursor: 'pointer',
      fontSize: 12,
      fontWeight: 500,
      fontFamily: theme.typography.fontFamily,
      background: 'none',
      color: 'rgba(204,204,220,0.61)',
      whiteSpace: 'nowrap',
    }),
    tabActive: css({
      background: '#111217',
      color: '#6e9fff',
    }),
    tabIcon: css({
      color: 'inherit',
    }),
    scroll: css({
      flex: 1,
      overflowY: 'auto',
      paddingTop: 8,
    }),
    section: css({
      marginBottom: 4,
    }),
    sectionHeader: css({
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 8px',
      height: 28,
    }),
    sectionToggleBtn: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 16,
      height: 16,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: '#ccccdc',
      padding: 0,
      flexShrink: 0,
    }),
    sectionTitle: css({
      flex: 1,
      fontSize: 12,
      fontWeight: 300,
      color: '#ffffff',
      fontFamily: theme.typography.fontFamily,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    addBtn: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 20,
      height: 20,
      background: '#3d71d9',
      border: 'none',
      borderRadius: 4,
      cursor: 'pointer',
      color: '#ffffff',
      padding: '3px',
      flexShrink: 0,
    }),
    queryList: css({
      paddingBottom: 8,
    }),
    footer: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 32,
      background: '#181b1f',
      borderTop: '1px solid rgba(204,204,220,0.12)',
      borderRadius: '0 0 6px 6px',
      padding: '1px 12px',
      flexShrink: 0,
    }),
    footerCount: css({
      fontSize: 12,
      fontWeight: 500,
      color: '#ccccdc',
      fontFamily: theme.typography.fontFamily,
    }),
    footerActions: css({
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }),
    footerStat: css({
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 12,
      fontWeight: 500,
      color: '#ccccdc',
      fontFamily: theme.typography.fontFamily,
    }),
    footerIcon: css({
      color: '#ccccdc',
    }),
  };
}
