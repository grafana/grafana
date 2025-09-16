export type BarMarkerOpts = {
  label?: string;
  width?: number;
  color?: string;
  shape?: string;
  isRotated: boolean
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
  yValue? : number | null;
  // the y value a marker is set at.
  seriesField?: string | null;
  seriesIdx?: number | null;
  opts?: BarMarkerOpts | null;
}

/**
 * Resolved marker with mapping to uPlot/u.data indices. This is computed in prepData
 * and cached for the draw hook.
 */
export interface ResolvedMarker {
  id?: string;
  x: number
  y:  number
  label?: string | null;
  opts?: BarMarkerOpts | null;
}

export default {};
