export type BarMarkerOpts = {
  label: string;
  width: number;
  color: string;
  shape: string;
  isRotated: boolean;
  opacity: number;
};

export interface Marker {
  id: number;
  targetField: string;
  dataField: string;
  opts: BarMarkerOpts;
}
/**
 * User-specified marker persisted in panel options (runtime shape).
 * Keep this file stable so it can be imported without touching generated files.
 */
export interface PreparedMarker {
  // optional direct index into aligned x (dataIdx)
  groupIdx?: number | null;
  yScaleKey?: string;
  yValue?: number | null;
  seriesIdx?: number | null;
  opts: BarMarkerOpts;
}

/**
 * Resolved marker with mapping to uPlot/u.data indices. This is computed in prepData
 * and cached for the draw hook.
 */
export interface ResolvedMarker {
  x: number;
  y: number;
  opts: BarMarkerOpts | null;
}

export default {};
