export type BarMarkerOpts = {
  label: string;
  size: number;
  color: string;
  shape: string;
  opacity: number;
};

export interface Marker {
  id: number;
  targetField: string;
  dataField: string;
  opts: BarMarkerOpts;
}

export interface PreparedMarker {
  groupIdx?: number | null;
  yScaleKey?: string;
  yValue?: number | null;
  seriesIdx?: number | null;
  opts: BarMarkerOpts;
}

export interface ResolvedMarker {
  x: number;
  y: number;
  opts: BarMarkerOpts;
  isRotated?: boolean;
}

export default {};
