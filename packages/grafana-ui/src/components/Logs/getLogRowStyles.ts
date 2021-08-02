import { css } from '@emotion/css';
import { GrafanaTheme, LogLevel } from '@grafana/data';
import { styleMixins, stylesFactory } from '../../themes';

export const getLogRowStyles = stylesFactory((theme: GrafanaTheme, logLevel?: LogLevel) => {
  let logColor = theme.isLight ? theme.palette.gray5 : theme.palette.gray2;
  const hoverBgColor = styleMixins.hoverColor(theme.colors.panelBg, theme);

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
      logColor = theme.palette.yellow;
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
    logsRowMatchHighLight: css`
      label: logs-row__match-highlight;
      background: inherit;
      padding: inherit;
      color: ${theme.palette.yellow};
      background-color: rgba(${theme.palette.yellow}, 0.1);
    `,
    logsRowMatchHighLightPreview: css`
      label: logs-row__match-highlight--preview;
      background-color: rgba(${theme.palette.yellow}, 0.2);
      border-bottom-style: dotted;
    `,
    logsRowsTable: css`
      label: logs-rows;
      font-family: ${theme.typography.fontFamily.monospace};
      font-size: ${theme.typography.size.sm};
      width: 100%;
    `,
    context: css`
      label: context;
      visibility: hidden;
      white-space: nowrap;
      position: relative;
      margin-left: 10px;
    `,
    logsRow: css`
      label: logs-row;
      width: 100%;
      cursor: pointer;
      vertical-align: top;

      &:hover {
        .log-row-context {
          visibility: visible;
          z-index: 1;
          text-decoration: underline;
          &:hover {
            color: ${theme.palette.yellow};
          }
        }
      }

      td:last-child {
        width: 100%;
      }

      > td {
        padding-right: ${theme.spacing.sm};
        border-top: ${theme.border.width.sm} solid transparent;
        border-bottom: ${theme.border.width.sm} solid transparent;
        height: 100%;
      }

      &:hover {
        background: ${hoverBgColor};
      }
    `,
    logsRowDuplicates: css`
      label: logs-row__duplicates;
      text-align: right;
      width: 4em;
      cursor: default;
    `,
    logsRowLevel: css`
      label: logs-row__level;
      position: relative;
      max-width: 10px;
      cursor: default;
      &::after {
        content: '';
        display: block;
        position: absolute;
        top: 1px;
        bottom: 1px;
        width: 3px;
        left: 4px;
        background-color: ${logColor};
      }
    `,
    logIconError: css`
      color: ${theme.palette.red};
    `,
    logsRowToggleDetails: css`
      label: logs-row-toggle-details__level;
      position: relative;
      font-size: 9px;
      padding-top: 5px;
      max-width: 15px;
    `,
    logsRowLocalTime: css`
      label: logs-row__localtime;
      white-space: nowrap;
    `,
    logsRowLabels: css`
      label: logs-row__labels;
      white-space: nowrap;
      max-width: 22em;
    `,
    logsRowMessage: css`
      label: logs-row__message;
      white-space: pre-wrap;
      word-break: break-all;
    `,
    //Log details specific CSS
    logDetailsContainer: css`
      label: logs-row-details-table;
      border: 1px solid ${theme.colors.border2};
      padding: 0 ${theme.spacing.sm} ${theme.spacing.sm};
      border-radius: 3px;
      margin: 20px 8px 20px 16px;
      cursor: default;
    `,
    logDetailsTable: css`
      label: logs-row-details-table;
      line-height: 18px;
      width: 100%;
      td:last-child {
        width: 100%;
      }
    `,
    logsDetailsIcon: css`
      label: logs-row-details__icon;
      position: relative;
      color: ${theme.palette.gray3};
      padding-top: 6px;
      padding-left: 6px;
    `,
    logDetailsLabel: css`
      label: logs-row-details__label;
      max-width: 30em;
      min-width: 20em;
      padding: 0 ${theme.spacing.sm};
      overflow-wrap: break-word;
    `,
    logDetailsHeading: css`
      label: logs-row-details__heading;
      font-weight: ${theme.typography.weight.bold};
      padding: ${theme.spacing.sm} 0 ${theme.spacing.xs};
    `,
    logDetailsValue: css`
      label: logs-row-details__row;
      position: relative;
      vertical-align: middle;
      cursor: default;

      &:hover {
        background-color: ${hoverBgColor};
      }
    `,
  };
});
