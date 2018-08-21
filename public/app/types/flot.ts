export interface FlotOptions {
  series?: FlotSeriesOptions;
  colors?: Array<Color>;
  legend?: any;
  yaxes?: any;
  xaxis?: any;
  grid?: any;
}

export interface FlotSeriesOptions {
  lines?: {
    show?: boolean;
    /**
     * Thickness of the line or outline in pixels. You can set it to 0 to prevent a line or outline from being drawn;
     * this will also hide the shadow.
     */
    lineWidth?: number;
    /**
     * Is whether the shape should be filled. You can adjust the opacity of the fill by setting `fill` to a number
     * between 0 (fully transparent) and 1 (fully opaque).
     */
    fill?: boolean | number;
    /**
     * Color of the fill.
     * If `fillColor` evaluates to false (default for everything except points which are filled with white),
     * the fill color is auto-set to the color of the data series.
     */
    fillColor?: string | Color | Gradient;
    /**
     * Area and bar charts normally start from zero, regardless of the data's range. This is because they convey
     * information through size, and starting from a different value would distort their meaning. In cases where
     * the fill is purely for decorative purposes, however, "zero" allows you to override this behavior. It defaults
     * to true for filled lines and bars; setting it to false tells the series to use the same automatic scaling
     * as an un-filled line.
     */
    zero?: boolean;
    /**
     * Specifies whether two adjacent data points are connected with a straight (possibly diagonal) line
     * or with first a horizontal and then a vertical line. Note that this transforms the data by adding extra points.
     */
    steps?: boolean;
  };

  bars?: {
    show?: boolean;
    lineWidth?: number;
    fill?: boolean | number;
    fillColor?: string | null;
    zero?: boolean;
    barWidth?: number;
    align?: 'left' | 'right' | 'center';
    horizontal?: boolean;
  };

  points?: {
    show?: boolean;
    lineWidth?: number;
    fill?: boolean | number;
    fillColor?: string | null;
    radius?: number;
    symbol?: 'circle' | PointSymbolCallback;
  };

  /** The default size of shadows in pixels. Set it to 0 to remove shadows. */
  shadowSize?: number;
  /** Default color of the translucent overlay used to highlight the series when the mouse hovers over it. */
  highlightColor?: number | Color;
}

/**
 * For points, you can specify the radius and the symbol. The only built-in symbol type is circles,
 * for other types you can use a plugin or define them yourself by specifying a callback:
 *
 * ```
 * function cross(ctx, x, y, radius, shadow) {
 *   var size = radius * Math.sqrt(Math.PI) / 2;
 *   ctx.moveTo(x - size, y - size);
 *   ctx.lineTo(x + size, y + size);
 *   ctx.moveTo(x - size, y + size);
 *   ctx.lineTo(x + size, y - size);
 * }
 * ```
 */
export type PointSymbolCallback = (ctx: DrawingContext, x: number, y: number, radius: number, shadow: any) => void;

export type DrawingContext = any;

export type Color = string;

export type Gradient = { colors: Array<Color> };
