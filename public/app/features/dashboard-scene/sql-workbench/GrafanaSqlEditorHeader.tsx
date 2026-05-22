import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import grafanaIconSvg from 'img/grafana_icon.svg';

interface Props {
  queryName: string;
  onBack: () => void;
}

export function GrafanaSqlEditorHeader({ queryName, onBack }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <button className={styles.iconBtn} onClick={onBack} title="Back to editor">
          <Icon name="arrow-left" size="sm" />
        </button>

        <div className={styles.datasourceSection}>
          <img src={grafanaIconSvg} alt="Grafana" className={styles.grafanaIcon} />
          <span className={styles.dsName}>grafana-sql</span>
          <Icon name="angle-down" size="sm" className={styles.chevron} />
        </div>

        <div className={styles.separator} />

        <div className={styles.queryNameSection}>
          <span className={styles.queryName}>{queryName}</span>
          <Icon name="pen" size="sm" className={styles.editIcon} />
        </div>
      </div>

      <div className={styles.spacer} />

      <div className={styles.actions}>
        <button className={styles.iconBtn} title="Toggle visibility">
          <Icon name="eye" size="sm" />
        </button>
        <button className={styles.iconBtn} title="Remove query">
          <Icon name="trash-alt" size="sm" />
        </button>
        <button className={styles.iconBtn} title="Duplicate query">
          <Icon name="copy" size="sm" />
        </button>
        <button className={styles.iconBtn} title="Collapse">
          <Icon name="angle-up" size="sm" />
        </button>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    header: css({
      display: 'flex',
      alignItems: 'center',
      height: 40,
      background: '#22252b',
      borderRadius: '6px 6px 0 0',
      padding: '4px 4px 4px 8px',
      flexShrink: 0,
    }),
    left: css({
      display: 'flex',
      alignItems: 'center',
      gap: 8,
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
    datasourceSection: css({
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '0 8px',
      height: 32,
      background: '#22252b',
      borderRadius: 6,
      cursor: 'pointer',
      minWidth: 120,
    }),
    grafanaIcon: css({
      width: 20,
      height: 20,
      objectFit: 'contain',
      flexShrink: 0,
    }),
    dsName: css({
      color: '#ccccdc',
      fontSize: 14,
      fontFamily: theme.typography.fontFamily,
      whiteSpace: 'nowrap',
    }),
    chevron: css({
      color: 'rgba(204,204,220,0.65)',
      marginLeft: 2,
    }),
    separator: css({
      width: 1,
      height: 24,
      background: 'rgba(204,204,220,0.2)',
    }),
    queryNameSection: css({
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '1px 5px',
      borderRadius: 6,
      border: '1px solid transparent',
      cursor: 'pointer',
      '&:hover': {
        border: '1px solid rgba(204,204,220,0.2)',
      },
    }),
    queryName: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: 14,
      color: '#ccccdc',
      lineHeight: '16px',
    }),
    editIcon: css({
      color: 'rgba(204,204,220,0.65)',
    }),
    spacer: css({
      flex: 1,
    }),
    actions: css({
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    }),
  };
}
