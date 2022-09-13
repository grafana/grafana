import { DataFrame } from '@grafana/data';

import { DimensionSupplier, ResourceDimensionConfig, ResourceDimensionMode } from './types';
import { findField, getLastNotNullFieldValue } from './utils';

//---------------------------------------------------------
// Resource dimension
//---------------------------------------------------------
export function getPublicOrAbsoluteUrl(v: string): string {
  if (!v) {
    return '';
  }
  return v.indexOf(':/') > 0 ? v : (window as any).__grafana_public_path__ + v;
}

export function getResourceDimension(
  frame: DataFrame | undefined,
  config: ResourceDimensionConfig
): DimensionSupplier<string> {
  const mode = config.mode ?? ResourceDimensionMode.Fixed;
  if (mode === ResourceDimensionMode.Fixed) {
    const v = getPublicOrAbsoluteUrl(config.fixed!);
    return {
      isAssumed: !Boolean(v),
      fixed: v,
      value: () => v,
      get: (i) => v,
    };
  }

  const field = findField(frame, config.field);
  if (!field) {
    const v = '';
    return {
      isAssumed: true,
      fixed: v,
      value: () => v,
      get: (i) => v,
    };
  }

  if (mode === ResourceDimensionMode.Mapping) {
    const mapper = (v: any) => getPublicOrAbsoluteUrl(`${v}`);
    return {
      field,
      get: (i) => mapper(field.values.get(i)),
      value: () => mapper(getLastNotNullFieldValue(field)),
    };
  }

  const getIcon = (value: any): string => {
    const disp = field.display!;
    return getPublicOrAbsoluteUrl(disp(value).icon ?? '');
  };

  return {
    field,
    get: (index: number): string => getIcon(field.values.get(index)),
    value: () => getIcon(getLastNotNullFieldValue(field)),
  };
}
