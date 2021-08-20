// TODO: this should be generated with cue

/**
 * Explicit control for visualization text settings
 * @public
 **/
export interface VizTextDisplayOptions {
  /* Explicit title text size */
  titleSize?: number;
  /* Explicit value text size */
  valueSize?: number;
}

/**
 * @public
 */
export interface OptionsWithTextFormatting {
  text?: VizTextDisplayOptions;
}
