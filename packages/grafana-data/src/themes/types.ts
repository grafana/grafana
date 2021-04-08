/** @alpha */
export interface ThemePaletteColor {
  /** color intent (primary, secondary, info, error, etc) */
  name: string;
  /** Main color */
  main: string;
  /** Used for text */
  text: string;
  /** Used for text */
  border: string;
  /** Used subtly colored backgrounds */
  transparent: string;
  /** Text color for text ontop of main */
  contrastText: string;
}

/** @internal */
export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};
