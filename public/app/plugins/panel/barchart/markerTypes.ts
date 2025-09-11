// Migration-safe marker types for the barchart plugin.
export type MarkerOpts = {
  color?: string;
  width?: number;
};

/**
 * User-specified marker persisted in panel options (runtime shape).
 * Keep this file stable so it can be imported without touching generated files.
 */
export interface Marker {
  id?: string;
  // canonical reference value for the x-axis group; can be the raw x value or timestamp
  xValue?: string | number | null;
  // optional direct index into aligned x (dataIdx)
  xIndex?: number | null;
  // optional reference to series by name or index
  seriesField?: string | null;
  seriesIdx?: number | null;
  label?: string | null;
  opts?: MarkerOpts | null;
}

/**
 * Resolved marker with mapping to uPlot/u.data indices. This is computed in prepData
 * and cached for the draw hook.
 */
export interface ResolvedMarker {
  id?: string;
  xValue?: string | number | null;
  dataIdx: number | null; // index into aligned x (u.data[0]) or null if unresolved
  uSeriesIdx?: number | null; // index into u.data (same indexing as aligned fields)
  label?: string | null;
  opts?: MarkerOpts | null;
}

export default {};
