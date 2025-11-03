export type BarMarkerOpts = {
  label: string;
  size: number;
  color: string;
  shape: string;
  opacity: number;
};

// Group of markers as they are defined in the panels settings.
// Each group represents a set of markers to be drawn on a target field, with y values taken from the data field.
export interface MarkerGroup {
  id: number;
  targetField: string;
  dataField: string;
  opts: BarMarkerOpts;
}

//Individual markers after being matched to data points
export interface PreparedMarker {
  groupIdx?: number | null;
  yScaleKey?: string;
  yValue?: number | null;
  seriesIdx?: number | null;
  opts: BarMarkerOpts;
}

//Markers with pixel positions for rendering
export interface MarkerDrawingArgs {
  x: number;
  y: number;
  opts: BarMarkerOpts;
  isRotated?: boolean;
}

export default {};
