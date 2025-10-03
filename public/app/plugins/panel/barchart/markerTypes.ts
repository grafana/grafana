import data from '../../../features/alerting/unified/components/rules/central-state-history/__fixtures__/alert-state-history';


export type BarMarkerOpts = {
  label: string;
  width: number;
  color: string;
  shape: string;
  isRotated: boolean
};

export interface Marker {
  id: number;
  // optional direct index into aligned x (dataIdx)
  targetField: string;
  dataField: string;
  opts: BarMarkerOpts 
}
/**
 * User-specified marker persisted in panel options (runtime shape).
 * Keep this file stable so it can be imported without touching generated files.
 */
export interface PreparedMarker {
  id: number;
  // optional direct index into aligned x (dataIdx)
  groupIdx?: number | null;
  yScaleKey?: string;
  yValue? : number | null;
  dataIdx?: number | null; // needed for tooltip lookup
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
  opts: BarMarkerOpts | null;
  sidx?: number
  didx?: number
}

export default {};
