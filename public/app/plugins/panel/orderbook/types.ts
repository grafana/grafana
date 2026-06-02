/**
 * The order book panel reads price levels from a single data frame and renders them as a
 * depth-of-market view (asks above the mid price, bids below). Field names are auto-detected
 * but can be overridden in the panel options. The schema is hand-written (no panelcfg.cue) since
 * this panel is not part of the CUE-generated kind registry.
 */

export enum BarAlign {
  Left = 'left',
  Right = 'right',
}

export enum MidPriceSource {
  /** Midpoint between the best bid and the best ask. */
  Auto = 'auto',
  /** First value of an explicit field. */
  Field = 'field',
}

export interface Options {
  /** Field holding the price of each level. Auto-detected when empty. */
  priceField?: string;
  /** Field holding the size/volume of each level. Auto-detected when empty. */
  sizeField?: string;
  /** Field holding the side ('bid'/'buy' or 'ask'/'sell'). When empty, levels are split by the mid price. */
  sideField?: string;

  /** How the mid price marker is derived. */
  midPriceSource: MidPriceSource;
  /** Field used when midPriceSource is 'field'. */
  midPriceField?: string;

  /** Maximum number of levels rendered per side (0 = all). */
  maxLevels: number;

  bidColor: string;
  askColor: string;

  /** Show the per-level change (delta) column. */
  showDelta: boolean;
  /** Show the per-level size column. */
  showSize: boolean;
  /** Show the cumulative size (sum) column. */
  showSum: boolean;
  /** Render the cumulative-depth background bar. */
  showDepth: boolean;
  /** Render the mid-price marker row between bids and asks. */
  showMidPrice: boolean;

  /** Which edge the bars grow from. */
  barAlign: BarAlign;
  /** Vertical gap between adjacent level bars, in pixels. */
  barGap: number;
}

export const defaultOptions: Options = {
  midPriceSource: MidPriceSource.Auto,
  maxLevels: 0,
  bidColor: 'green',
  askColor: 'red',
  showDelta: true,
  showSize: true,
  showSum: true,
  showDepth: true,
  showMidPrice: true,
  barAlign: BarAlign.Left,
  barGap: 1,
};
