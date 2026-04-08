import { type PanelData } from '@grafana/data';
import {
  type ColorDimensionConfig,
  type ResourceDimensionConfig,
  type ScalarDimensionConfig,
  type ScaleDimensionConfig,
  type TextDimensionConfig,
  type DirectionDimensionConfig,
  type ConnectionDirection,
} from '@grafana/schema';

import { type DimensionSupplier } from './types';

export interface DimensionContext {
  getColor(color: ColorDimensionConfig): DimensionSupplier<string>;

  getScale(scale: ScaleDimensionConfig): DimensionSupplier<number>;

  getScalar(scalar: ScalarDimensionConfig): DimensionSupplier<number>;

  getText(text: TextDimensionConfig): DimensionSupplier<string>;

  getResource(resource: ResourceDimensionConfig): DimensionSupplier<string>;

  getDirection(direction: DirectionDimensionConfig): DimensionSupplier<ConnectionDirection>;

  getPanelData(): PanelData | undefined;
}
