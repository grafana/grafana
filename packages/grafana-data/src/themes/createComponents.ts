/** @beta */
export interface ThemeComponents {
  /** Applies to normal buttons, inputs, radio buttons, etc */
  height: {
    sm: number;
    md: number;
    lg: number;
  };
  panel: {
    padding: number;
    headerHeight: number;
  };
}

export function createComponents(): ThemeComponents {
  return {
    height: {
      sm: 3,
      md: 4,
      lg: 6,
    },
    panel: {
      padding: 1,
      headerHeight: 4,
    },
  };
}
