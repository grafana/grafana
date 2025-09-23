/** @beta */
export interface ThemeShape {
  /**
   * @deprecated Use `theme.shape.radius.default`, `theme.shape.radius.pill` or `theme.shape.radius.circle` instead
   */
  borderRadius: (amount?: number) => string;
  radius: Radii;
}

interface Radii {
  default: string;
  sm: string;
  lg: string;
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
    sm: `${Math.ceil(baseBorderRadius * (1 / 3))}px`, // for default base becomes 2
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
