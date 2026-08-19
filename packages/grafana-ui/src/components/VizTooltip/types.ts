import { type LineStyle } from '@grafana/schema';

/** @alpha */
export enum VizTooltipColorIndicator {
  /** A colored line segment, used for time series and line charts. */
  series = 'series',
  /** A solid color swatch, used for by-value coloring modes. */
  value = 'value',
  /** A hexagon shape, used for geomap and similar panels. */
  hexagon = 'hexagon',
  /** A pie slice representing 1/4 fill. */
  pie_1_4 = 'pie_1_4',
  /** A pie slice representing 2/4 (half) fill. */
  pie_2_4 = 'pie_2_4',
  /** A pie slice representing 3/4 fill. */
  pie_3_4 = 'pie_3_4',
  /** A small circular marker. */
  marker_sm = 'marker_sm',
  /** A medium circular marker. */
  marker_md = 'marker_md',
  /** A large circular marker. */
  marker_lg = 'marker_lg',
}

/** @alpha */
export enum VizTooltipColorPlacement {
  /** No color indicator is rendered. */
  hidden = 'hidden',
  /** Color indicator appears before the label. */
  first = 'first',
  /** Color indicator appears between the label and value. */
  leading = 'leading',
  /** Color indicator appears after the value. */
  trailing = 'trailing',
}

/** @alpha */
export interface VizTooltipDelta {
  /**
   * Formatted difference, carrying the field's unit and decimal formatting (e.g. `'5 B'`, `'1.5 s'`).
   * This cannot be derived from `numeric` alone, which is why it is kept alongside it.
   */
  text: string;
  /**
   * Raw numeric difference. Its sign selects the text color; a zero or non-numeric (NaN) difference
   * renders uncolored.
   */
  numeric: number;
}

/** @alpha */
export interface VizTooltipItem {
  /** Display label for this row. */
  label: string;
  /** Formatted display value for this row. */
  value: string;
  /** CSS color string used for the color indicator. */
  color?: string;
  /** Shape of the color indicator. Defaults to `VizTooltipColorIndicator.series`. */
  colorIndicator?: VizTooltipColorIndicator;
  /** Position of the color indicator relative to the label and value. */
  colorPlacement?: VizTooltipColorPlacement;
  /** Whether this row corresponds to the currently hovered series (highlights the row). */
  isActive?: boolean;
  /** Line style, used by time series panels to match the series line style in the indicator. */
  lineStyle?: LineStyle;
  /** When true the row's color indicator is rendered hollow, indicating the field is not shown in the visualization. */
  isHiddenFromViz?: boolean;

  /**
   * Difference against the hovered series, set on time-comparison counterpart rows. Rendered after
   * `value` and colored by the sign of its `numeric`. Kept out of `value` so that `value` stays a
   * plain string for clipboard copy and sorting.
   */
  delta?: VizTooltipDelta;

  /**
   * Numeric representation of `value` used for sorting rows.
   * @internal
   */
  numeric?: number;
}

/** @alpha */
export const DEFAULT_VIZ_TOOLTIP_COLOR_INDICATOR = VizTooltipColorIndicator.series;
