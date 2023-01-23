/**
 * A library containing most of the static shapes required by Grafana.
 *
 * @packageDocumentation
 */
export * from './veneer/common.types';
export * from './index.gen';
// TODO fix these duplicates
export type {
  ValueMappingResult,
  ValueMap,
  ValueMapping,
  FieldConfig,
  MappingType,
  RangeMap,
  RegexMap,
  SpecialValueMap,
  Threshold,
  ThresholdsConfig,
  ThresholdsMode,
} from './index.gen';
export { defaultFieldConfig, defaultThresholdsConfig } from './index.gen';
