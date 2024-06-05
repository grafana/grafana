/**
 * Mode to describe if a legend is isolated/selected or being appended to an existing
 * series selection.
 * @alpha
 */

export enum SeriesVisibilityChangeMode {
  ToggleSelection = 'select',
  AppendToSelection = 'append',
}

export type OnSelectRangeCallback = (selections: CartesianSelection2D[]) => void;

export interface RangeSelection1D {
  from: number;
  to: number;
}

export interface CartesianSelection2D {
  x?: RangeSelection1D;
  y?: RangeSelection1D;
}
