import { css } from '@emotion/css';
import memoizeOne from 'memoize-one';
import tinycolor from 'tinycolor2';

import { colorManipulator, GrafanaTheme2, LogLevel } from '@grafana/data';
import { styleMixins } from '@grafana/ui';

export const getLogLevelStyles = (theme: GrafanaTheme2, logLevel?: LogLevel) => {
  let logColor = theme.isLight ? theme.v1.palette.gray5 : theme.v1.palette.gray2;
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
    logsRowLevelColor: css({
      '&::after': {
        backgroundColor: logColor,
      },
    }),
  };
};

export const getLogRowStyles = memoizeOne((theme: GrafanaTheme2) => {
  const hoverBgColor = styleMixins.hoverColor(theme.colors.background.secondary, theme);
  const contextOutlineColor = tinycolor(theme.components.dashboard.background).setAlpha(0.7).toRgbString();
  return {
    logsRowLevel: css({
      label: 'logs-row__level',
      maxWidth: theme.spacing(1.25),
      cursor: 'default',
      '&::after': {
        content: "''",
        display: 'block',
        position: 'absolute',
        top: '1px',
        bottom: '1px',
        width: '3px',
        left: theme.spacing(0.5),
      },
    }),
    // Compared to logsRowLevel we need to make error logs wider to accommodate the icon
    logsRowWithError: css({
      maxWidth: `${theme.spacing(1.5)}`,
    }),
    logsRowMatchHighLight: css({
      label: 'logs-row__match-highlight',
      background: 'inherit',
      padding: 'inherit',
      color: theme.components.textHighlight.text,
      backgroundColor: theme.components.textHighlight.background,
    }),
    logRows: css({
      position: 'relative',
    }),
    shortcut: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      color: theme.colors.text.secondary,
      opacity: 0.7,
      fontSize: theme.typography.bodySmall.fontSize,
      marginTop: theme.spacing(1),
    }),
    logsRowsTable: css({
      label: 'logs-rows',
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      width: '100%',
      position: 'relative',
    }),
    logsRowsTableContain: css({
      contain: 'strict',
    }),
    highlightBackground: css({
      backgroundColor: tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString(),
    }),
    logsRow: css({
      label: 'logs-row',
      width: '100%',
      cursor: 'pointer',
      verticalAlign: 'top',

      '&:focus-within': {
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: '-2px',
      },

      '&:hover': {
        '.log-row-menu': {
          zIndex: 1,
        },

        background: hoverBgColor,
      },

      'td:not(.log-row-menu-cell):last-child': {
        width: '100%',
      },

      '> td:not(.log-row-menu-cell)': {
        position: 'relative',
        paddingRight: theme.spacing(1),
        borderTop: '1px solid transparent',
        borderBottom: '1px solid transparent',
        height: '100%',
      },
    }),
    logsRowDuplicates: css({
      label: 'logs-row__duplicates',
      textAlign: 'right',
      width: '4em',
      cursor: 'default',
    }),
    logIconError: css({
      color: theme.colors.warning.main,
      position: 'relative',
      top: '-2px',
    }),
    logIconInfo: css({
      color: theme.colors.info.main,
      position: 'relative',
      top: '-2px',
    }),
    logsRowToggleDetails: css({
      label: 'logs-row-toggle-details__level',
      fontSize: '9px',
      maxWidth: '15px',
    }),
    logsRowLocalTime: css({
      label: 'logs-row__localtime',
      whiteSpace: 'nowrap',
    }),
    logsRowLabels: css({
      label: 'logs-row__labels',
      whiteSpace: 'nowrap',
      maxWidth: '22em',

      /* This is to make the labels vertical align */
      '> span': {
        marginTop: '0.75px',
      },
    }),
    logsRowMessage: css({
      label: 'logs-row__message',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      overflowWrap: 'anywhere',
      width: '100%',
      textAlign: 'left',
    }),
    copyLogButton: css({
      padding: theme.spacing(0, 0, 0, 0.5),
      height: theme.spacing(3),
      width: theme.spacing(3.25),
      lineHeight: theme.spacing(2.5),
      overflow: 'hidden',
      '&:hover': {
        backgroundColor: colorManipulator.alpha(theme.colors.text.primary, 0.12),
      },
    }),
    //Log details specific CSS
    logDetailsContainer: css({
      label: 'logs-row-details-table',
      border: `1px solid ${theme.colors.border.medium}`,
      padding: theme.spacing(0, 1, 1),
      borderRadius: theme.shape.radius.default,
      margin: theme.spacing(2.5, 1, 2.5, 2),
      cursor: 'default',
    }),
    logDetailsSidebarContainer: css({
      label: 'logs-row-details-table',
      border: `1px solid ${theme.colors.border.medium}`,
      padding: theme.spacing(0, 1, 1),
      borderRadius: theme.shape.radius.default,
      margin: theme.spacing(0, 1, 0, 1),
      cursor: 'default',
    }),
    logDetailsTable: css({
      label: 'logs-row-details-table',
      lineHeight: '18px',
      width: '100%',
      'td:last-child': {
        width: '100%',
      },
    }),
    logsDetailsIcon: css({
      label: 'logs-row-details__icon',
      position: 'relative',
      color: theme.v1.palette.gray3,
      paddingTop: '1px',
      paddingBottom: '1px',
      paddingRight: theme.spacing(0.75),
    }),
    logDetailsLabel: css({
      label: 'logs-row-details__label',
      maxWidth: '30em',
      minWidth: '20em',
      padding: theme.spacing(0, 1),
      overflowWrap: 'break-word',
    }),
    logDetailsHeading: css({
      label: 'logs-row-details__heading',
      fontWeight: theme.typography.fontWeightBold,
      padding: theme.spacing(1, 0, 0.5),
    }),
    logDetailsValue: css({
      label: 'logs-row-details__row',
      position: 'relative',
      verticalAlign: 'middle',
      cursor: 'default',

      '&:hover': {
        backgroundColor: hoverBgColor,
      },
    }),
    detailsToggle: css({
      appearance: 'none',
      background: 'none',
      border: 'none',
      padding: 0,
      // Don't increase the height of the row
      maxHeight: '19px',

      // Don't show default button box-shadow on focus, we apply outline to the entire row instead
      '&:focus-visible': {
        boxShadow: 'none',
      },

      '&:focus': {
        outline: 0,
      },
      '&:after': {
        content: '""',
        inset: 0,
        position: 'absolute',
      },
    }),

    // Log row
    topVerticalAlign: css({
      label: 'topVerticalAlign',
      marginTop: theme.spacing(-0.9),
      marginLeft: theme.spacing(-0.25),
    }),
    detailsOpen: css({
      '&:hover': {
        backgroundColor: styleMixins.hoverColor(theme.colors.background.primary, theme),
      },
    }),
    errorLogRow: css({
      label: 'erroredLogRow',
      color: theme.colors.text.secondary,
    }),
    // Log Row Message
    positionRelative: css({
      label: 'positionRelative',
      position: 'relative',
    }),
    rowWithContext: css({
      label: 'rowWithContext',
      zIndex: 1,
      outline: `9999px solid ${contextOutlineColor}`,
      display: 'inherit',
    }),
    horizontalScroll: css({
      label: 'horizontalScroll',
      whiteSpace: 'pre',
    }),
    contextNewline: css({
      display: 'block',
      marginLeft: '0px',
    }),
    rowMenu: css({
      label: 'rowMenu',
      display: 'flex',
      flexWrap: 'nowrap',
      flexDirection: 'row',
      alignContent: 'flex-end',
      justifyContent: 'space-evenly',
      alignItems: 'center',
      position: 'absolute',
      top: 0,
      bottom: 'auto',
      background: theme.colors.background.primary,
      boxShadow: theme.shadows.z3,
      padding: theme.spacing(0.5, 1, 0.5, 1),
      zIndex: 100,
      gap: theme.spacing(0.5),

      '& > button': {
        margin: 0,
      },
    }),
    logRowMenuCell: css({
      position: 'sticky',
      zIndex: theme.zIndex.dropdown,
      marginTop: theme.spacing(-0.125),
      right: 0,

      '& > span': {
        transform: 'translateX(-100%)',
      },
    }),
    logLine: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      letterSpacing: theme.typography.bodySmall.letterSpacing,
      textAlign: 'left',
      padding: 0,
      userSelect: 'text',
    }),
    // Log details
    logsRowLevelDetails: css({
      label: 'logs-row__level_details',
      '&::after': {
        top: '-3px',
      },
    }),
    logDetails: css({
      label: 'logDetailsDefaultCursor',
      cursor: 'default',

      '&:hover': {
        backgroundColor: theme.colors.background.primary,
      },
    }),
    visibleRowMenu: css({
      label: 'visibleRowMenu',
      aspectRatio: '1/1',
      zIndex: 90,
    }),
    linkButton: css({
      label: 'linkButton',
      '> button': {
        paddingTop: theme.spacing(0.5),
      },
    }),
    hidden: css({
      label: 'hidden',
      visibility: 'hidden',
    }),
    unPinButton: css({
      height: theme.spacing(3),
      lineHeight: theme.spacing(2.5),
    }),
  };
});

export type LogRowStyles = ReturnType<typeof getLogRowStyles>;
