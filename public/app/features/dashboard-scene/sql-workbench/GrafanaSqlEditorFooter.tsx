import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

export function GrafanaSqlEditorFooter() {
  const styles = useStyles2(getStyles);

  const metaItems: Array<{ label: string; value: string }> = [
    { label: 'Max data points', value: '500' },
    { label: 'Min interval', value: 'No limit' },
    { label: 'Interval', value: '30s' },
    { label: 'Relative time', value: '1h' },
    { label: 'Time shift', value: '1h' },
  ];

  return (
    <div className={styles.footer}>
      <button className={styles.queryOptionsBtn}>
        Query Options
        <Icon name="angle-down" size="sm" className={styles.chevron} />
      </button>

      <div className={styles.metaList}>
        {metaItems.map(({ label, value }) => (
          <button key={label} className={styles.metaItem}>
            <span className={styles.metaLabel}>{label}</span>
            <span className={styles.metaValue}>{value}</span>
          </button>
        ))}
      </div>

      <div className={styles.spacer} />

      <button className={styles.iconBtn} title="Query inspector">
        <span className={styles.braces}>{'{}'}</span>
      </button>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    footer: css({
      display: 'flex',
      alignItems: 'center',
      height: 32,
      background: '#181b1f',
      borderTop: '1px solid rgba(204,204,220,0.12)',
      borderRadius: '0 0 6px 6px',
      padding: '0 4px 0 12px',
      flexShrink: 0,
    }),
    queryOptionsBtn: css({
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      height: 24,
      padding: '1px 8px',
      background: 'none',
      border: '1px solid transparent',
      borderRadius: 6,
      cursor: 'pointer',
      color: '#6e9fff',
      fontSize: 12,
      fontWeight: 500,
      fontFamily: theme.typography.fontFamily,
      whiteSpace: 'nowrap',
      '&:hover': {
        background: 'rgba(110,159,255,0.08)',
      },
    }),
    chevron: css({
      color: '#6e9fff',
    }),
    metaList: css({
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      overflow: 'hidden',
    }),
    metaItem: css({
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      height: 24,
      padding: '1px 4px',
      background: 'none',
      border: '1px solid transparent',
      borderRadius: 6,
      cursor: 'pointer',
      '&:hover': {
        background: 'rgba(204,204,220,0.06)',
      },
    }),
    metaLabel: css({
      fontSize: 12,
      fontWeight: 500,
      color: '#ccccdc',
      fontFamily: theme.typography.fontFamily,
      whiteSpace: 'nowrap',
    }),
    metaValue: css({
      fontSize: 12,
      fontWeight: 500,
      color: 'rgba(204,204,220,0.65)',
      fontFamily: theme.typography.fontFamilyMonospace,
      whiteSpace: 'nowrap',
    }),
    spacer: css({
      flex: 1,
    }),
    iconBtn: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 24,
      height: 24,
      background: 'none',
      border: '1px solid transparent',
      borderRadius: 6,
      cursor: 'pointer',
      color: '#ccccdc',
      padding: '1px 4px',
      '&:hover': {
        background: 'rgba(204,204,220,0.08)',
      },
    }),
    braces: css({
      fontSize: 12,
      fontFamily: theme.typography.fontFamilyMonospace,
      color: 'rgba(204,204,220,0.65)',
    }),
  };
}
