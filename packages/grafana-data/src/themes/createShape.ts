/** @beta */
export interface ThemeShape {
  /**
   * @deprecated Use `theme.shape.radius.default`, `theme.shape.radius.pill` or `theme.shape.radius.circle` instead
   */
  borderRadius: (amount?: number) => string;
  radius: Radii;
}

export interface Radii {
  /**
   * Use for most things (inputs, buttons, cards, panels, etc)
   * Same as `md`
   */
  default: string;
  /**
   * Use for most things (inputs, buttons, cards, panels, etc)
   * Same as `default`
   */
  md: string;
  /**
   * Use for smaller things like chips, tags and badges
   */
  sm: string;
  /**
   * Use for large things, like modals
   */
  lg: string;
  /**
   * Used to create maximum half circle sides (e.g. for pills)
   */
  pill: string;
  circle: string;
}

/** @internal */
export interface ThemeShapeInput {
  borderRadius?: number;
}

export function createShape(options: ThemeShapeInput): ThemeShape {
  const baseBorderRadius = options.borderRadius ?? 6;

  const radius = {
    default: `${baseBorderRadius}px`,
    md: `${baseBorderRadius}px`,
    sm: `${Math.ceil(baseBorderRadius * (2 / 3))}px`, // for default base becomes 4
    lg: `${Math.ceil(baseBorderRadius * (5 / 3))}px`, // for default base becomes 10
    pill: '9999px',
    circle: '100%',
  };

  /**
   * @deprecated Use `theme.shape.radius.default`, `theme.shape.radius.pill` or `theme.shape.radius.circle`instead
   * @param amount
   */
  const borderRadius = (amount?: number) => {
    const value = (amount ?? 1) * baseBorderRadius;
    return `${value}px`;
  };

  return {
    radius,
    borderRadius,
  };
}
