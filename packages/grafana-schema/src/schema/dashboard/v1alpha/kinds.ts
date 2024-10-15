import { AnnotationQuery, DashboardLink } from '../../../index.gen';

import { Kind, Reference } from './common';
import { QuerySpec, QueryVariableSpec, TextVariableSpec, QueryGroupSpec, VizConfigSpec } from './specs';

export type QueryVariableKind = Kind<'QueryVariable', QueryVariableSpec>;
export type TextVariableKind = Kind<'TextVariable', TextVariableSpec>;

export type QueryKind = Kind<'Query', QuerySpec>;

interface GridLayoutItemSpec {
  x: number;
  y: number;
  width: number;
  height: number;
  element: Reference;
}

export interface GridLayoutSpec {
  items: GridLayoutItemKind[];
}

export type GridLayoutItemKind = Kind<'GridLayoutItem', GridLayoutItemSpec>;
export type GridLayoutKind = Kind<'GridLayout', GridLayoutSpec>;

export type QueryGroupKind = Kind<'QueryGroup', QueryGroupSpec>;

// Eventually this will become a plugin-specific kind, TimeSeriesConfigKind, BarChartConfigKind
// Since we don't have those kinds exposed from plugins anywhere ATM lets keep the interface open enough to allow union in the future
type VizConfigKind = Kind<string, VizConfigSpec>;

interface PanelSpec {
  uid: string;
  title: string;
  description: string;
  links: DashboardLink[];
  data: QueryGroupKind;
  vizConfig: VizConfigKind;
}

export type PanelKind = Kind<'Panel', PanelSpec>;

export type AnnotationKind = Kind<'Annotation', AnnotationQuery>;
