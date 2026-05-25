import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import lokiLogo from 'app/plugins/datasource/loki/img/loki_icon.svg';
import prometheusLogo from 'app/plugins/datasource/prometheus/img/prometheus_logo.svg';

import { type GrafanaSqlStructure } from './grafanaSqlParser';

const DS_LOGO_MAP: Record<string, string> = {
  prometheus: prometheusLogo,
  loki: lokiLogo,
};

interface Props {
  structure: GrafanaSqlStructure;
  isSelected?: boolean;
}

export function GrafanaSqlQueryCard({ structure, isSelected = false }: Props) {
  const styles = useStyles2(getStyles, isSelected);

  return (
    <div className={styles.card}>
      <div className={styles.badgeRow}>
        <span className={styles.dot} />
        <span className={styles.queryId}>A</span>
      </div>
      <div className={styles.schematic}>
        {structure.ctes.map((cte, i) => {
          const logoSrc = DS_LOGO_MAP[cte.datasourceType.toLowerCase()];
          return (
            <div key={cte.name} className={styles.schematicRow}>
              <span className={styles.iconWrap}>
                {logoSrc ? (
                  <img src={logoSrc} alt={cte.datasourceType} className={styles.dsLogo} />
                ) : (
                  <Icon name="database" size="sm" className={styles.fallbackIcon} />
                )}
              </span>
              <span className={i === 0 ? styles.cteNameBold : styles.cteNameLight}>{cte.name}</span>
            </div>
          );
        })}
        {structure.joins.map((join, i) => (
          <div key={i} className={styles.schematicRow}>
            <span className={styles.iconWrap}>
              <Icon name="code-branch" size="sm" className={styles.joinIcon} />
            </span>
            <span className={styles.cteNameLight}>join</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2, isSelected: boolean) {
  return {
    card: css({
      position: 'relative',
      border: `1px solid ${isSelected ? '#f90' : 'rgba(204,204,220,0.12)'}`,
      borderRadius: 6,
      background: 'rgba(255,255,255,0)',
      padding: '7px 8px 10px',
      overflow: 'hidden',
      margin: '0 8px',
    }),
    badgeRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      marginBottom: 6,
    }),
    dot: css({
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: isSelected ? '#f90' : 'rgba(204,204,220,0.4)',
      flexShrink: 0,
    }),
    queryId: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: 14,
      color: '#ccccdc',
      lineHeight: '16px',
    }),
    schematic: css({
      display: 'flex',
      flexDirection: 'column',
      gap: 11,
      paddingLeft: 20,
    }),
    schematicRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    }),
    iconWrap: css({
      width: 16,
      height: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }),
    dsLogo: css({
      width: 16,
      height: 16,
      objectFit: 'contain',
    }),
    fallbackIcon: css({
      color: theme.colors.text.secondary,
    }),
    joinIcon: css({
      color: '#ccccdc',
    }),
    cteNameBold: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: 14,
      fontWeight: 700,
      color: '#ccccdc',
      lineHeight: '16px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    cteNameLight: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: 14,
      fontWeight: 300,
      color: '#ccccdc',
      lineHeight: '16px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
  };
}
