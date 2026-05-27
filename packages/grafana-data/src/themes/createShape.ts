import { type ThemeShapeInput } from './types/schema.mts';
import { type ThemeShape } from './types/shape.mts';

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
