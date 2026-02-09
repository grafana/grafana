import { css } from "@emotion/css";
import tinycolor from "tinycolor2";

import { GrafanaTheme2 } from "@grafana/data";

import { LOG_LINE_BODY_FIELD_NAME } from "../LogDetailsBody";

import { DEFAULT_LINE_HEIGHT, FIELD_GAP_MULTIPLIER, LogLineVirtualization } from "./virtualization";


export type LogLineStyles = ReturnType<typeof getStyles>;
export const getStyles = (
  theme: GrafanaTheme2,
  virtualization: LogLineVirtualization | undefined = undefined,
  displayedFields: string[] = []
) => {
  const base = tinycolor(theme.colors.background.primary);

  let maxContrast = theme.isDark
    ? tinycolor(theme.colors.text.maxContrast).darken(10).toRgbString()
    : tinycolor(theme.colors.text.maxContrast).lighten(10).toRgbString();
  let colorDefault = theme.isDark
    ? theme.colors.text.primary
    : tinycolor(theme.colors.text.maxContrast).lighten(30).toRgbString();
  const contrast1 = tinycolor.readability(base, maxContrast);
  const contrast2 = tinycolor.readability(base, colorDefault);

  if (!displayedFields.length || (displayedFields.length === 1 && displayedFields.includes(LOG_LINE_BODY_FIELD_NAME))) {
    colorDefault = theme.colors.text.primary;
    maxContrast = theme.colors.text.primary;
  } else if (contrast1 < contrast2) {
    colorDefault = maxContrast;
    maxContrast = theme.colors.text.primary;
  }

  const colors = {
    critical: '#B877D9',
    error: theme.colors.error.text,
    warning: '#FBAD37',
    debug: '#6E9FFF',
    trace: '#6ed0e0',
    info: '#6CCF8E',
    metadata: theme.colors.text.secondary,
    default: colorDefault,
    parsedField: theme.colors.text.secondary,
    logLineBody: maxContrast,
  };

  const hoverColor = tinycolor(theme.colors.background.canvas).darken(11).toRgbString();

  return {
    logLine: css({
      color: colors.default,
      display: 'flex',
      gap: theme.spacing(0.5),
      flexDirection: 'row',
      fontFamily: theme.typography.fontFamilyMonospace,
      wordBreak: 'break-all',
      '&:hover': {
        background: hoverColor,
      },
      '&.infinite-scroll': {
        '&::before': {
          borderTop: `solid 1px ${theme.colors.border.strong}`,
          content: '""',
          height: 0,
          left: 0,
          position: 'absolute',
          top: -3,
          width: '100%',
        },
      },
      '& .log-syntax-highlight': {
        '.log-token-string': {
          color: colors.logLineBody,
        },
        '.log-token-duration': {
          color: theme.colors.success.text,
        },
        '.log-token-size': {
          color: theme.colors.success.text,
        },
        '.log-token-uuid': {
          color: theme.colors.success.text,
        },
        '.log-token-key': {
          color: colors.parsedField,
          fontWeight: theme.typography.fontWeightMedium,
        },
        '.log-token-json-key': {
          color: colors.parsedField,
          opacity: 0.9,
          fontWeight: theme.typography.fontWeightMedium,
        },
        '.log-token-label': {
          color: colors.metadata,
          fontWeight: theme.typography.fontWeightBold,
        },
        '.log-token-method': {
          color: theme.colors.info.shade,
        },
        '.log-search-match': {
          color: theme.components.textHighlight.text,
          backgroundColor: theme.components.textHighlight.background,
        },
        '&.log-line-body': {
          color: colors.logLineBody,
        },
      },
      '& .no-highlighting': {
        color: theme.colors.text.primary,
      },
    }),
    matchHighLight: css({
      color: theme.components.textHighlight.text,
      backgroundColor: theme.components.textHighlight.background,
    }),
    fontSizeSmall: css({
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: theme.typography.bodySmall.lineHeight,
    }),
    fontSizeDefault: css({
      fontSize: theme.typography.fontSize,
      lineHeight: theme.typography.body.lineHeight,
    }),
    detailsDisplayed: css({
      background: tinycolor(theme.colors.background.canvas)
        .darken(theme.isDark ? 2 : 5)
        .toRgbString(),
    }),
    currentLog: css({
      background: hoverColor,
      fontWeight: theme.typography.fontWeightBold,
    }),
    pinnedLogLine: css({
      backgroundColor: tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString(),
    }),
    permalinkedLogLine: css({
      backgroundColor: tinycolor(theme.colors.info.transparent).setAlpha(0.25).toString(),
    }),
    menuIcon: css({
      height: virtualization?.getLineHeight() ?? DEFAULT_LINE_HEIGHT,
      margin: 0,
      padding: theme.spacing(0, 0, 0, 0.5),
    }),
    logLineMessage: css({
      fontFamily: theme.typography.fontFamily,
      justifyContent: 'center',
    }),
    timestamp: css({
      color: theme.colors.text.disabled,
      display: 'inline-block',
    }),
    duplicates: css({
      flexShrink: 0,
      textAlign: 'center',
      width: theme.spacing(4.5),
    }),
    hasError: css({
      flexShrink: 0,
      width: theme.spacing(2),
      '& svg': {
        position: 'relative',
        top: -1,
      },
    }),
    isSampled: css({
      flexShrink: 0,
      width: theme.spacing(2),
      '& svg': {
        position: 'relative',
        top: -1,
      },
    }),
    logIconError: css({
      color: theme.colors.warning.main,
    }),
    logIconInfo: css({
      color: theme.colors.info.main,
    }),
    level: css({
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightBold,
      textTransform: 'uppercase',
      display: 'inline-block',
      '&.level-critical': {
        color: colors.critical,
      },
      '&.level-error': {
        color: colors.error,
      },
      '&.level-warning': {
        color: colors.warning,
      },
      '&.level-info': {
        color: colors.info,
      },
      '&.level-debug': {
        color: colors.debug,
      },
    }),
    loadMoreButton: css({
      background: 'transparent',
      border: 'none',
      display: 'inline',
    }),
    loadMoreTopContainer: css({
      backgroundColor: tinycolor(theme.colors.background.primary).setAlpha(0.75).toString(),
      left: 0,
      position: 'absolute',
      top: 0,
      width: '100%',
      zIndex: theme.zIndex.navbarFixed,
    }),
    overflows: css({
      outline: 'solid 1px red',
    }),
    clickable: css({
      cursor: 'pointer',
    }),
    unwrappedLogLine: css({
      display: 'grid',
      gridColumnGap: theme.spacing(FIELD_GAP_MULTIPLIER),
      whiteSpace: 'pre',
      paddingBottom: theme.spacing(0.75),
    }),
    wrappedLogLine: css({
      alignSelf: 'flex-start',
      paddingBottom: theme.spacing(0.75),
      whiteSpace: 'pre-wrap',
      '& .field': {
        marginRight: theme.spacing(FIELD_GAP_MULTIPLIER),
      },
      '& .field:last-child': {
        marginRight: 0,
      },
    }),
    fieldsWrapper: css({
      minHeight: virtualization ? virtualization.getLineHeight() + virtualization.getPaddingBottom() : undefined,
      '&:hover': {
        background: hoverColor,
      },
    }),
    collapsedLogLine: css({
      overflow: 'hidden',
    }),
    expandCollapseControl: css({
      display: 'flex',
      justifyContent: 'center',
    }),
    expandCollapseControlButton: css({
      fontWeight: theme.typography.fontWeightLight,
      height: virtualization?.getLineHeight() ?? DEFAULT_LINE_HEIGHT,
      margin: 0,
    }),
  };
};
