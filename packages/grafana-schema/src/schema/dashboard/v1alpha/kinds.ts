import { AnnotationQuery, DashboardLink } from '../../../index.gen';

import { Kind, Reference } from './common';
import {
  QuerySpec,
  TimeSettingsSpec,
  QueryVariableSpec,
  TextVariableSpec,
  QueryGroupSpec,
  VizConfigSpec,
} from './specs';

export type QueryVariableKind = Kind<'QueryVariable', QueryVariableSpec>;
export type TextVariableKind = Kind<'TextVariable', TextVariableSpec>;

export type QueryKind = Kind<'Query', QuerySpec>;

export type TimeSettingsKind = Kind<'TimeSettings', TimeSettingsSpec>;

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

type VizConfigKind = Kind<'VizConfig', VizConfigSpec>;

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
