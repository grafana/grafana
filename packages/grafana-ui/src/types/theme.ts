export enum GrafanaThemeType {
  Light = 'light',
  Dark = 'dark',
}

export interface GrafanaTheme {
  type: GrafanaThemeType;
  name: string;
  // TODO: not sure if should be a part of theme
  brakpoints: {
    xs: string;
    s: string;
    m: string;
    l: string;
    xl: string;
  };
  typography: {
    fontFamily: {
      sansSerif: string;
      serif: string;
      monospace: string;
    };
    size: {
      base: string;
      xs: string;
      s: string;
      m: string;
      l: string;
    };
    weight: {
      light: number;
      normal: number;
      semibold: number;
    };
    lineHeight: {
      xs: number; //1
      s: number; //1.1
      m: number; // 4/3
      l: number; // 1.5
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
  };
  spacing: {
    xs: string;
    s: string;
    m: string;
    l: string;
    gutter: string;
  };
  border: {
    radius: {
      xs: string;
      s: string;
      m: string;
    };
  };
  background: {
    dropdown: string;
    scrollbar: string;
    scrollbar2: string;
  };
  colors: {
    black: string;
    white: string;
    dark1: string;
    dark2: string;
    dark3: string;
    dark4: string;
    dark5: string;
    gray1: string;
    gray2: string;
    gray3: string;
    gray4: string;
    gray5: string;
    gray6: string;
    gray7: string;
    grayBlue: string;
    inputBlack: string;

    // Accent colors
    blue: string;
    blueLight: string;
    blueDark: string;
    green: string;
    red: string;
    yellow: string;
    pink: string;
    purple: string;
    variable: string;
    orange: string;
    queryRed: string;
    queryGreen: string;
    queryPurple: string;
    queryKeyword: string;
    queryOrange: string;

    // Status colors
    online: string;
    warn: string;
    critical: string;

    // TODO: move to background section
    bodyBg: string;
    pageBg: string;
    bodyColor: string;
    textColor: string;
    textColorStrong: string;
    textColorWeak: string;
    textColorFaint: string;
    textColorEmphasis: string;
    linkColor: string;
    linkColorDisabled: string;
    linkColorHover: string;
    linkColorExternal: string;
    headingColor: string;
  };
}

export interface Themeable {
  theme: GrafanaTheme;
}
