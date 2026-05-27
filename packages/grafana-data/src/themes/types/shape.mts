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

/** @beta */
export interface ThemeShape {
  /**
   * @deprecated Use `theme.shape.radius.default`, `theme.shape.radius.pill` or `theme.shape.radius.circle` instead
   */
  borderRadius: (amount?: number) => string;
  radius: Radii;
}
