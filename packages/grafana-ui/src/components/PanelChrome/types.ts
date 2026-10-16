import { type QueryResultMetaNotice } from '@grafana/data';

/**
 * Mode to describe if a legend is isolated/selected or being appended to an existing
 * series selection.
 * @alpha
 */

export enum SeriesVisibilityChangeMode {
  ToggleSelection = 'select',
  AppendToSelection = 'append',
  SetExactly = 'setExactly',
}

export type OnSelectRangeCallback = (selections: RangeSelection2D[]) => void;

export interface RangeSelection1D {
  from: number;
  to: number;
}

export interface RangeSelection2D {
  x?: RangeSelection1D;
  y?: RangeSelection1D;
}

/**
 * Severity of a panel status item, ordered by importance (error > warning > info).
 * Mirrors the severity of a query result notice.
 * @internal
 */
export type PanelStatusSeverity = QueryResultMetaNotice['severity'];

/**
 * A single error or notice shown in the panel header status popover.
 * @internal
 */
export interface PanelStatusItem {
  severity: PanelStatusSeverity;
  text: string;
}
