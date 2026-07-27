import { z } from 'zod';

const DEFAULT_BORDER_RADIUS_SM = 4;
const DEFAULT_BORDER_RADIUS_MD = 6;
const DEFAULT_BORDER_RADIUS_LG = 10;

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
   * Use for large things, like modals and containers
   */
  lg: string;
  /**
   * Used to create maximum half circle sides (e.g. for pills)
   */
  pill: string;
  circle: string;
}

/** @internal */
export const ThemeShapeInputSchema = z.object({
  borderRadiusSm: z.int().nonnegative().optional(),
  borderRadius: z.int().nonnegative().optional(),
  borderRadiusLg: z.int().nonnegative().optional(),
});

/** @internal */
export type ThemeShapeInput = z.infer<typeof ThemeShapeInputSchema>;

export function createShape({
  borderRadiusSm = DEFAULT_BORDER_RADIUS_SM,
  borderRadius: borderRadiusMd = DEFAULT_BORDER_RADIUS_MD,
  borderRadiusLg = DEFAULT_BORDER_RADIUS_LG,
}: ThemeShapeInput): ThemeShape {
  const radius = {
    default: `${borderRadiusMd}px`,
    sm: `${borderRadiusSm}px`,
    md: `${borderRadiusMd}px`,
    lg: `${borderRadiusLg}px`,
    pill: '9999px',
    circle: '100%',
  };

  /**
   * @deprecated Use `theme.shape.radius.default`, `theme.shape.radius.pill` or `theme.shape.radius.circle`instead
   * @param amount
   */
  const borderRadius = (amount?: number) => {
    const value = (amount ?? 1) * borderRadiusMd;
    return `${value}px`;
  };

  return {
    radius,
    borderRadius,
  };
}
