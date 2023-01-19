import { css } from '@emotion/css';

import { GrafanaTheme2, LogLevel } from '@grafana/data';
import { styleMixins } from '@grafana/ui';

export const getLogRowStyles = (theme: GrafanaTheme2, logLevel?: LogLevel) => {
  let logColor = theme.isLight ? theme.v1.palette.gray5 : theme.v1.palette.gray2;
  const hoverBgColor = styleMixins.hoverColor(theme.colors.background.secondary, theme);

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
      logColor = theme.colors.warning.main;
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
      color: ${theme.components.textHighlight.text}
      background-color: ${theme.components.textHighlight};
    `,
    logsRowsTable: css`
      label: logs-rows;
      font-family: ${theme.typography.fontFamilyMonospace};
      font-size: ${theme.typography.bodySmall.fontSize};
      width: 100%;
    `,
    contextBackground: css`
      background: ${hoverBgColor};
    `,
    logsRow: css`
      label: logs-row;
      width: 100%;
      cursor: pointer;
      vertical-align: top;

      &:hover {
        .log-row-menu {
          visibility: visible;
          z-index: 1;
        }

        background: ${hoverBgColor};
      }

      td:not(.log-row-menu-cell):last-child {
        width: 100%;
      }

      > td:not(.log-row-menu-cell) {
        position: relative;
        padding-right: ${theme.spacing(1)};
        border-top: 1px solid transparent;
        border-bottom: 1px solid transparent;
        height: 100%;
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
      max-width: ${theme.spacing(1.25)};
      cursor: default;
      &::after {
        content: '';
        display: block;
        position: absolute;
        top: 1px;
        bottom: 1px;
        width: 3px;
        left: ${theme.spacing(0.5)};
        background-color: ${logColor};
      }
    `,
    logIconError: css`
      color: ${theme.colors.warning.main};
    `,
    logsRowToggleDetails: css`
      label: logs-row-toggle-details__level;
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

      /* This is to make the labels vertical align */
      > span {
        margin-top: 0.75px;
      }
    `,
    logsRowMessage: css`
      label: logs-row__message;
      white-space: pre-wrap;
      word-break: break-all;
      overflow-wrap: anywhere;
      width: 100%;
      text-align: left;
    `,
    //Log details specific CSS
    logDetailsContainer: css`
      label: logs-row-details-table;
      border: 1px solid ${theme.colors.border.medium};
      padding: 0 ${theme.spacing(1)} ${theme.spacing(1)};
      border-radius: ${theme.shape.borderRadius(1.5)};
      margin: ${theme.spacing(2.5)} ${theme.spacing(1)} ${theme.spacing(2.5)} ${theme.spacing(2)};
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
      color: ${theme.v1.palette.gray3};
      padding-top: ${theme.spacing(0.75)};
      padding-left: ${theme.spacing(0.75)};
    `,
    logDetailsLabel: css`
      label: logs-row-details__label;
      max-width: 30em;
      min-width: 20em;
      padding: 0 ${theme.spacing(1)};
      overflow-wrap: break-word;
    `,
    logDetailsHeading: css`
      label: logs-row-details__heading;
      font-weight: ${theme.typography.fontWeightBold};
      padding: ${theme.spacing(1)} 0 ${theme.spacing(0.5)};
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
};
