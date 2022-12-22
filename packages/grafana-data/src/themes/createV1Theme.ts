import { GrafanaTheme, GrafanaThemeCommons, GrafanaThemeType } from '../types';

import { GrafanaTheme2 } from './types';

export function createV1Theme(theme: Omit<GrafanaTheme2, 'v1'>): GrafanaTheme {
  const oldCommon: GrafanaThemeCommons = {
    name: 'Grafana Default',
    typography: {
      fontFamily: {
        sansSerif: theme.typography.fontFamily,
        monospace: theme.typography.fontFamilyMonospace,
      },
      size: {
        base: `${theme.typography.fontSize}px`,
        xs: theme.typography.size.xs,
        sm: theme.typography.size.sm,
        md: theme.typography.size.md,
        lg: theme.typography.size.lg,
      },
      heading: {
        h1: theme.typography.h1.fontSize,
        h2: theme.typography.h2.fontSize,
        h3: theme.typography.h3.fontSize,
        h4: theme.typography.h4.fontSize,
        h5: theme.typography.h5.fontSize,
        h6: theme.typography.h6.fontSize,
      },
      weight: {
        light: theme.typography.fontWeightLight,
        regular: theme.typography.fontWeightRegular,
        semibold: theme.typography.fontWeightMedium,
        bold: theme.typography.fontWeightBold,
      },
      lineHeight: {
        xs: theme.typography.bodySmall.lineHeight,
        sm: theme.typography.bodySmall.lineHeight,
        md: theme.typography.body.lineHeight,
        lg: theme.typography.h2.lineHeight,
      },
      link: {
        decoration: 'none',
        hoverDecoration: 'none',
      },
    },
    breakpoints: {
      xs: `${theme.breakpoints.values.xs}px`,
      sm: `${theme.breakpoints.values.sm}px`,
      md: `${theme.breakpoints.values.md}px`,
      lg: `${theme.breakpoints.values.lg}px`,
      xl: `${theme.breakpoints.values.xl}px`,
      xxl: `${theme.breakpoints.values.xxl}px`,
    },
    spacing: {
      base: theme.spacing.gridSize,
      insetSquishMd: theme.spacing(0.5, 1),
      d: theme.spacing(2),
      xxs: theme.spacing(0.25),
      xs: theme.spacing(0.5),
      sm: theme.spacing(1),
      md: theme.spacing(2),
      lg: theme.spacing(3),
      xl: theme.spacing(4),
      gutter: theme.spacing(4),

      // Next-gen forms spacing variables
      // TODO: Move variables definition to respective components when implementing
      formSpacingBase: theme.spacing.gridSize,
      formMargin: `${theme.spacing.gridSize * 4}px`,
      formFieldsetMargin: `${theme.spacing.gridSize * 2}px`,
      formInputHeight: theme.spacing.gridSize * 4,
      formButtonHeight: theme.spacing.gridSize * 4,
      formInputPaddingHorizontal: `${theme.spacing.gridSize}px`,

      // Used for icons do define spacing between icon and input field
      // Applied on the right(prefix) or left(suffix)
      formInputAffixPaddingHorizontal: `${theme.spacing.gridSize / 2}px`,

      formInputMargin: `${theme.spacing.gridSize * 2}px`,
      formLabelPadding: '0 0 0 2px',
      formLabelMargin: `0 0 ${theme.spacing.gridSize / 2 + 'px'} 0`,
      formValidationMessagePadding: '4px 8px',
      formValidationMessageMargin: '4px 0 0 0',
      inlineFormMargin: '4px',
    },
    border: {
      radius: {
        sm: theme.shape.borderRadius(1),
        md: theme.shape.borderRadius(2),
        lg: theme.shape.borderRadius(3),
      },
      width: {
        sm: '1px',
      },
    },
    height: {
      sm: theme.spacing.gridSize * theme.components.height.sm,
      md: theme.spacing.gridSize * theme.components.height.md,
      lg: theme.spacing.gridSize * theme.components.height.lg,
    },
    panelPadding: theme.components.panel.padding * theme.spacing.gridSize,
    panelHeaderHeight: theme.spacing.gridSize * theme.components.panel.headerHeight,
    zIndex: theme.zIndex,
  };

  const basicColors = {
    ...commonColorsPalette,
    black: '#000000',
    white: '#ffffff',
    dark1: '#141414',
    dark2: '#161719',
    dark3: '#1f1f20',
    dark4: '#212124',
    dark5: '#222426',
    dark6: '#262628',
    dark7: '#292a2d',
    dark8: '#2f2f32',
    dark9: '#343436',
    dark10: '#424345',
    gray1: '#555555',
    gray2: '#8e8e8e',
    gray3: '#b3b3b3',
    gray4: '#d8d9da',
    gray5: '#ececec',
    gray6: '#f4f5f8', // not used in dark theme
    gray7: '#fbfbfb', // not used in dark theme
    redBase: '#e02f44',
    redShade: '#c4162a',
    greenBase: '#299c46',
    greenShade: '#23843b',
    red: '#d44a3a',
    yellow: '#ecbb13',
    purple: '#9933cc',
    variable: '#32d1df',
    orange: '#eb7b18',
    orangeDark: '#ff780a',
  };

  const backgrounds = {
    bg1: theme.colors.background.primary,
    bg2: theme.colors.background.secondary,
    bg3: theme.colors.action.hover,
    dashboardBg: theme.colors.background.canvas,
    bgBlue1: theme.colors.primary.main,
    bgBlue2: theme.colors.primary.shade,
  };

  const borders = {
    border1: theme.colors.border.weak,
    border2: theme.colors.border.medium,
    border3: theme.colors.border.strong,
  };

  const textColors = {
    textStrong: theme.colors.text.maxContrast,
    textHeading: theme.colors.text.primary,
    text: theme.colors.text.primary,
    textSemiWeak: theme.colors.text.secondary,
    textWeak: theme.colors.text.secondary,
    textFaint: theme.colors.text.disabled,
    textBlue: theme.colors.primary.text,
  };

  const form = {
    // Next-gen forms functional colors
    formLabel: theme.colors.text.primary,
    formDescription: theme.colors.text.secondary,
    formInputBg: theme.components.input.background,
    formInputBgDisabled: theme.colors.action.disabledBackground,
    formInputBorder: theme.components.input.borderColor,
    formInputBorderHover: theme.components.input.borderHover,
    formInputBorderActive: theme.colors.primary.border,
    formInputBorderInvalid: theme.colors.error.border,
    formInputPlaceholderText: theme.colors.text.disabled,
    formInputText: theme.components.input.text,
    formInputDisabledText: theme.colors.action.disabledText,
    formFocusOutline: theme.colors.primary.main,
    formValidationMessageText: theme.colors.error.contrastText,
    formValidationMessageBg: theme.colors.error.main,
  };

  return {
    ...oldCommon,
    type: theme.colors.mode === 'dark' ? GrafanaThemeType.Dark : GrafanaThemeType.Light,
    isDark: theme.isDark,
    isLight: theme.isLight,
    name: theme.name,
    palette: {
      ...basicColors,
      brandPrimary: basicColors.orange,
      brandSuccess: theme.colors.success.main,
      brandWarning: theme.colors.warning.main,
      brandDanger: theme.colors.error.main,
      queryRed: theme.colors.error.text,
      queryGreen: theme.colors.success.text,
      queryPurple: '#fe85fc',
      queryOrange: basicColors.orange,
      online: theme.colors.success.main,
      warn: theme.colors.success.main,
      critical: theme.colors.success.main,
    },
    colors: {
      ...backgrounds,
      ...borders,
      ...form,
      ...textColors,

      bodyBg: theme.colors.background.canvas,
      panelBg: theme.components.panel.background,
      panelBorder: theme.components.panel.borderColor,
      pageHeaderBg: theme.colors.background.canvas,
      pageHeaderBorder: theme.colors.background.canvas,

      dropdownBg: form.formInputBg,
      dropdownShadow: basicColors.black,
      dropdownOptionHoverBg: backgrounds.bg2,

      link: theme.colors.text.primary,
      linkDisabled: theme.colors.text.disabled,
      linkHover: theme.colors.text.maxContrast,
      linkExternal: theme.colors.text.link,
    },
    shadows: {
      listItem: 'none',
    },
    visualization: theme.visualization,
  };
}

const commonColorsPalette = {
  // New greys palette used by next-gen form elements
  gray98: '#f7f8fa',
  gray97: '#f1f5f9',
  gray95: '#e9edf2',
  gray90: '#dce1e6',
  gray85: '#c7d0d9',
  gray70: '#9fa7b3',
  gray60: '#7b8087',
  gray33: '#464c54',
  gray25: '#2c3235',
  gray15: '#202226',
  gray10: '#141619',
  gray05: '#0b0c0e',

  // New blues palette used by next-gen form elements
  blue95: '#5794f2', // blue95
  blue85: '#33a2e5', // blueText
  blue80: '#3274d9', // blue80
  blue77: '#1f60c4', // blue77

  // New reds palette used by next-gen form elements
  red88: '#e02f44',
};
