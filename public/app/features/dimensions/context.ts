import { PanelData } from '@grafana/data';
import {
  ColorDimensionConfig,
  ResourceDimensionConfig,
  ScalarDimensionConfig,
  ScaleDimensionConfig,
  TextDimensionConfig,
  DirectionDimensionConfig,
  ConnectionDirection,
} from '@grafana/schema';

import { DimensionSupplier } from './types';

export interface DimensionContext {
  getColor(color: ColorDimensionConfig): DimensionSupplier<string>;

  getScale(scale: ScaleDimensionConfig): DimensionSupplier<number>;

  getScalar(scalar: ScalarDimensionConfig): DimensionSupplier<number>;

  getText(text: TextDimensionConfig): DimensionSupplier<string>;

  getResource(resource: ResourceDimensionConfig): DimensionSupplier<string>;

  getDirection(direction: DirectionDimensionConfig): DimensionSupplier<ConnectionDirection>;

  getPanelData(): PanelData | undefined;
}
