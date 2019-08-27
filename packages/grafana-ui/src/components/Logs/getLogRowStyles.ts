import { css } from 'emotion';
import { LogLevel } from '@grafana/data';

import { GrafanaTheme } from '../../types/theme';
import { selectThemeVariant } from '../../themes/selectThemeVariant';

export const getLogRowStyles = (theme: GrafanaTheme, logLevel?: LogLevel) => {
  let logColor = selectThemeVariant({ light: theme.colors.gray5, dark: theme.colors.gray2 }, theme.type);
  switch (logLevel) {
    case LogLevel.crit:
    case LogLevel.critical:
      logColor = '#705da0';
      break;
    case LogLevel.error:
    case LogLevel.err:
      logColor = '#e24d42';
      break;
    case LogLevel.warning:
    case LogLevel.warn:
      logColor = theme.colors.yellow;
      break;
    case LogLevel.info:
      logColor = '#7eb26d';
      break;
    case LogLevel.debug:
      logColor = '#1f78c1';
      break;
    case LogLevel.trace:
      logColor = '#6ed0e0';
      break;
  }

  return {
    logsRowFieldHighLight: css`
      label: logs-row__field-highlight;
      background: inherit;
      padding: inherit;
      border-bottom: 1px dotted ${theme.colors.yellow};

      .logs-row__field-highlight--icon {
        margin-left: 0.5em;
        cursor: pointer;
        display: none;
      }

      &:hover {
        color: ${theme.colors.yellow};
        border-bottom-style: solid;

        .logs-row__field-highlight--icon {
          display: inline;
        }
      }
    `,
    logsRowMatchHighLight: css`
      label: logs-row__match-highlight;
      background: inherit;
      padding: inherit;

      color: ${theme.colors.yellow};
      border-bottom: 1px solid ${theme.colors.yellow};
      background-color: rgba(${theme.colors.yellow}, 0.1);
    `,
    logsRowMatchHighLightPreview: css`
      label: logs-row__match-highlight--preview;
      background-color: rgba(${theme.colors.yellow}, 0.2);
      border-bottom-style: dotted;
    `,
    logsRows: css`
      label: logs-rows;
      font-family: ${theme.typography.fontFamily.monospace};
      font-size: ${theme.typography.size.sm};
      display: table;
      table-layout: fixed;
      width: 100%;
    `,
    logsRow: css`
      label: logs-row;
      display: table-row;

      > div {
        display: table-cell;
        padding-right: 10px;
        border-top: 1px solid transparent;
        border-bottom: 1px solid transparent;
        height: 100%;
      }

      &:hover {
        background: ${theme.colors.pageBg};
      }
    `,
    logsRowDuplicates: css`
      label: logs-row__duplicates;
      text-align: right;
      width: 4em;
    `,
    logsRowLevel: css`
      label: logs-row__level;
      position: relative;
      width: 10px;

      &::after {
        content: '';
        display: block;
        position: absolute;
        top: 1px;
        bottom: 1px;
        width: 3px;
        background-color: ${logColor};
      }
    `,
    logsRowLocalTime: css`
      label: logs-row__localtime;
      white-space: nowrap;
      width: 12.5em;
    `,
    logsRowLabels: css`
      label: logs-row__labels;
      width: 20%;
      line-height: 1.2;
      position: relative;
    `,
    logsRowMessage: css`
      label: logs-row__message;
      word-break: break-all;
    `,
    logsRowStats: css`
      label: logs-row__stats;
      margin: 5px 0;
    `,
  };
};
