export enum GrafanaThemeType {
  Light = 'light',
  Dark = 'dark',
}

export interface GrafanaThemeCommons {
  name: string;
  // TODO: not sure if should be a part of theme
  breakpoints: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  typography: {
    fontFamily: {
      sansSerif: string;
      monospace: string;
    };
    size: {
      base: string;
      xs: string;
      sm: string;
      md: string;
      lg: string;
    };
    weight: {
      light: number;
      regular: number;
      semibold: number;
      bold: number;
    };
    lineHeight: {
      xs: number; //1
      sm: number; //1.1
      md: number; // 4/3
      lg: number; // 1.5
    };
    // TODO: Refactor to use size instead of custom defs
    heading: {
      h1: string;
      h2: string;
      h3: string;
      h4: string;
      h5: string;
      h6: string;
    };
    link: {
      decoration: string;
      hoverDecoration: string;
    };
  };
  spacing: {
    insetSquishMd: string;
    d: string;
    xxs: string;
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    gutter: string;

    // Next-gen forms spacing variables
    // TODO: Move variables definition to respective components when implementing
    formSpacingBase: number;
    formMargin: string;
    formFieldsetMargin: string;
    formLegendMargin: string;
    formInputHeight: string;
    formButtonHeight: number;
    formInputPaddingHorizontal: string;
    // Used for icons do define spacing between icon and input field
    // Applied on the right(prefix) or left(suffix)
    formInputAffixPaddingHorizontal: string;
    formInputMargin: string;
    formLabelPadding: string;
    formLabelMargin: string;
    formValidationMessagePadding: string;
    formValidationMessageMargin: string;
  };
  border: {
    radius: {
      sm: string;
      md: string;
      lg: string;
    };
    width: {
      sm: string;
    };
  };
  height: {
    sm: string;
    md: string;
    lg: string;
  };
  panelPadding: number;
  panelHeaderHeight: number;
  zIndex: {
    dropdown: string;
    navbarFixed: string;
    sidemenu: string;
    tooltip: string;
    modalBackdrop: string;
    modal: string;
    typeahead: string;
  };
}

export interface GrafanaTheme extends GrafanaThemeCommons {
  type: GrafanaThemeType;
  isDark: boolean;
  isLight: boolean;
  background: {
    dropdown: string;
    scrollbar: string;
    scrollbar2: string;
    pageHeader: string;
  };
  colors: {
    black: string;
    white: string;
    dark1: string;
    dark2: string;
    dark3: string;
    dark4: string;
    dark5: string;
    dark6: string;
    dark7: string;
    dark8: string;
    dark9: string;
    dark10: string;
    gray1: string;
    gray2: string;
    gray3: string;
    gray4: string;
    gray5: string;
    gray6: string;
    gray7: string;

    // New greys palette used by next-gen form elements
    gray98: string;
    gray95: string;
    gray85: string;
    gray70: string;
    gray60: string;
    gray33: string;
    gray25: string;
    gray15: string;
    gray10: string;
    gray05: string;

    // New blues palette used by next-gen form elements
    blue95: string;
    blue85: string;
    blue77: string;

    // New reds palette used by next-gen form elements
    red88: string;

    grayBlue: string;
    inputBlack: string;

    // Accent colors
    blue: string;
    blueBase: string;
    blueShade: string;
    blueLight: string;
    blueFaint: string;
    redBase: string;
    redShade: string;
    greenBase: string;
    greenShade: string;
    red: string;
    yellow: string;
    purple: string;
    variable: string;
    orange: string;
    orangeDark: string;
    queryRed: string;
    queryGreen: string;
    queryPurple: string;
    queryKeyword: string;
    queryOrange: string;
    brandPrimary: string;
    brandSuccess: string;
    brandWarning: string;
    brandDanger: string;

    // Status colors
    online: string;
    warn: string;
    critical: string;

    // Link colors
    link: string;
    linkDisabled: string;
    linkHover: string;
    linkExternal: string;

    // Text colors
    body: string;
    text: string;
    textStrong: string;
    textWeak: string;
    textFaint: string;
    textEmphasis: string;

    // panel
    panelBg: string;
    panelBorder: string;

    // TODO: move to background section
    bodyBg: string;
    pageBg: string;
    headingColor: string;

    pageHeaderBorder: string;

    // Next-gen forms functional colors
    formLabel: string;
    formDescription: string;
    formLegend: string;
    formInputBg: string;
    formInputBgDisabled: string;
    formInputBorder: string;
    formInputBorderHover: string;
    formInputBorderActive: string;
    formInputBorderInvalid: string;
    formFocusOutline: string;
    formInputText: string;
    formInputDisabledText: string;
    formInputPlaceholderText: string;
    formInputTextStrong: string;
    formInputTextWhite: string;
    formValidationMessageText: string;
    formValidationMessageBg: string;
    formSwitchBg: string;
    formSwitchBgActive: string;
    formSwitchBgActiveHover: string;
    formSwitchBgHover: string;
    formSwitchBgDisabled: string;
    formSwitchDot: string;
    formCheckboxBg: string;
    formCheckboxBgChecked: string;
    formCheckboxBgCheckedHover: string;
    formCheckboxCheckmark: string;
  };
  shadow: {
    pageHeader: string;
  };
}
