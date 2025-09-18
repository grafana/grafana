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
  id: number;
  // canonical reference value for the x-axis group; can be the raw x value or timestamp
  xValue: string | number 
  // optional direct index into aligned x (dataIdx)
  xIndex?: number | null;
  // optional reference to series by name or index
  yField?: string | null;
  yValue? : number | null;
  // the y value a marker is set at.
  seriesField?: string | null;
  seriesIdx?: number | null;
  opts: BarMarkerOpts 
}

/**
 * Resolved marker with mapping to uPlot/u.data indices. This is computed in prepData
 * and cached for the draw hook.
 */
export interface ResolvedMarker {
  id: number;
  x: number
  y:  number
  opts?: BarMarkerOpts | null;
}

export default {};
