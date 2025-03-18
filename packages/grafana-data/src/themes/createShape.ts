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
  pill: string;
  circle: string;
}

/** @internal */
export interface ThemeShapeInput {
  borderRadius?: number;
}

export function createShape(options: ThemeShapeInput): ThemeShape {
  const baseBorderRadius = options.borderRadius ?? 2;

  const radius = {
    default: `${baseBorderRadius}px`,
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
