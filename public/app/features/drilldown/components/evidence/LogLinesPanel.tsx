import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { PanelChrome, useStyles2 } from '@grafana/ui';

import { LOG_LINES, type LogLevel } from '../../mockScenario';

export function LogLinesPanel() {
  const styles = useStyles2(getStyles);

  return (
    <PanelChrome title={t('drilldown-page.evidence.log-lines', 'Log lines')}>
      <ul className={styles.list}>
        {LOG_LINES.map((line, index) => (
          <li key={index} className={styles.line(line.level)}>
            {line.time} {line.level.toUpperCase().padEnd(5)} {line.message}
          </li>
        ))}
      </ul>
    </PanelChrome>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const levelColors: Record<LogLevel, string> = {
    error: theme.colors.error.main,
    warn: theme.colors.warning.main,
    info: theme.colors.success.main,
  };

  return {
    list: css({
      listStyle: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    line: (level: LogLevel) =>
      css({
        borderLeft: `3px solid ${levelColors[level]}`,
        paddingLeft: theme.spacing(1),
        fontFamily: theme.typography.fontFamilyMonospace,
        fontSize: theme.typography.body.fontSize,
        lineHeight: '22px',
        whiteSpace: 'pre',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }),
  };
};
