import { CSSInterpolation } from '@emotion/css';
import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

function buttonBackgroundMixin(
  startColor: string,
  endColor: string,
  textColor = '#fff',
  textShadow = '0px 1px 0 rgba(0, 0, 0, 0.1)'
) {
  return {
    backgroundColor: startColor,
    backgroundImage: `linear-gradient(to bottom, ${startColor}, ${endColor})`,
    backgroundRepeat: 'repeat-x',
    color: textColor,
    textShadow: textShadow,
    borderColor: startColor,

    // in these cases the gradient won't cover the background, so we override
    '&:hover, &:focus, &:active, &.active, &.disabled, &[disabled]': {
      color: textColor,
      backgroundImage: 'none',
      backgroundColor: startColor,
    },
  };
}

function buttonSizeMixin(paddingY: string, paddingX: string, fontSize: string, borderRadius: string) {
  return {
    padding: `${paddingY} ${paddingX}`,
    fontSize: fontSize,
    borderRadius: borderRadius,
  };
}

function widthMixin(theme: GrafanaTheme2, max: number) {
  let result: CSSInterpolation = {};
  for (let i = 1; i <= max; i++) {
    const width = `${theme.spacing(2 * i)} !important`;
    result[`.width-${i}`] = {
      width,
    };
    result[`.max-width-${i}`] = {
      maxWidth: width,
      flexGrow: 1,
    };
    result[`.min-width-${i}`] = {
      minWidth: width,
    };
    result[`.offset-width-${i}`] = {
      marginLeft: width,
    };
  }
  return result;
}

export function getUtilityClassStyles(theme: GrafanaTheme2) {
  return css({
    '.highlight-word': {
      color: theme.v1.palette.orange,
    },
    '.hide': {
      display: 'none',
    },
    '.show': {
      display: 'block',
    },
    '.invisible': {
      // can't avoid type assertion here due to !important
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      visibility: 'hidden !important' as 'hidden',
    },
    '.absolute': {
      position: 'absolute',
    },
    '.flex-grow-1': {
      flexGrow: 1,
    },
    '.flex-shrink-1': {
      flexShrink: 1,
    },
    '.flex-shrink-0': {
      flexShrink: 0,
    },
    '.center-vh': {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      justifyItems: 'center',
    },
    '.btn': {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.body.lineHeight,
      textAlign: 'center',
      verticalAlign: 'middle',
      cursor: 'pointer',
      border: 'none',
      height: `${theme.spacing.gridSize * theme.components.height.md}px`,
      ...buttonSizeMixin(
        theme.spacing(0),
        theme.spacing(2),
        `${theme.typography.fontSize}px`,
        theme.shape.radius.default
      ),

      '&, &:active, &.active': {
        '&:focus, &.focus': {
          outline: 'none',
        },
      },
      '&:focus, &:hover': {
        textDecoration: 'none',
      },
      '&.focus': {
        textDecoration: 'none',
      },
      '&:active, &.active': {
        backgroundImage: 'none',
        outline: 0,
      },
      '&.disabled, &[disabled], &:disabled': {
        cursor: 'not-allowed',
        opacity: 0.65,
        boxShadow: 'none',
        pointerEvents: 'none',
      },
    },
    '.btn-small': {
      ...buttonSizeMixin(theme.spacing(0.5), theme.spacing(1), theme.typography.size.sm, theme.shape.radius.default),
      height: `${theme.spacing.gridSize * theme.components.height.sm}px`,
    },
    // Deprecated, only used by old plugins
    '.btn-mini': {
      ...buttonSizeMixin(theme.spacing(0.5), theme.spacing(1), theme.typography.size.sm, theme.shape.radius.default),
      height: `${theme.spacing.gridSize * theme.components.height.sm}px`,
    },
    '.btn-success, .btn-primary': {
      ...buttonBackgroundMixin(theme.colors.primary.main, theme.colors.primary.shade),
    },
    '.btn-danger': {
      ...buttonBackgroundMixin(theme.colors.error.main, theme.colors.error.shade),
    },
    '.btn-secondary': {
      ...buttonBackgroundMixin(theme.colors.secondary.main, theme.colors.secondary.shade, theme.colors.text.primary),
    },
    '.btn-inverse': {
      ...buttonBackgroundMixin(
        theme.isDark ? theme.v1.palette.dark6 : theme.v1.palette.gray5,
        theme.isDark ? theme.v1.palette.dark5 : theme.v1.palette.gray4,
        theme.colors.text.primary
      ),
      '&': {
        boxShadow: 'none',
      },
    },
    '.typeahead': {
      zIndex: theme.zIndex.typeahead,
    },
    ...widthMixin(theme, 30),
  });
}
