import {
  ColorDimensionConfig,
  DimensionSupplier,
  ResourceDimensionConfig,
  ScaleDimensionConfig,
  TextDimensionConfig,
} from './types';

export interface DimensionContext {
  getColor(color: ColorDimensionConfig): DimensionSupplier<string>;
  getScale(scale: ScaleDimensionConfig): DimensionSupplier<number>;
  getText(text: TextDimensionConfig): DimensionSupplier<string>;
  getResource(resource: ResourceDimensionConfig): DimensionSupplier<string>;
}
