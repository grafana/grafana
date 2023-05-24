import { DataFrame } from '@grafana/data';
import { ResourceDimensionConfig, ResourceDimensionMode } from '@grafana/schema';

import { DimensionSupplier } from './types';
import { findField, getLastNotNullFieldValue } from './utils';

//---------------------------------------------------------
// Resource dimension
//---------------------------------------------------------
export function getPublicOrAbsoluteUrl(v: string): string {
  if (!v) {
    return '';
  }
  return v.indexOf(':/') > 0 ? v : window.__grafana_public_path__ + v;
}

export function getResourceDimension(
  frame: DataFrame | undefined,
  config: ResourceDimensionConfig
): DimensionSupplier<string> {
  const mode = config.mode ?? ResourceDimensionMode.Fixed;
  if (mode === ResourceDimensionMode.Fixed) {
    const v = getPublicOrAbsoluteUrl(config.fixed);
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
    const mapper = (v: string) => getPublicOrAbsoluteUrl(`${v}`);
    return {
      field,
      get: (i) => mapper(field.values[i]),
      value: () => mapper(getLastNotNullFieldValue(field)),
    };
  }

  // mode === ResourceDimensionMode.Field case
  const getIcon = (value: string): string => {
    if (field && field.display) {
      const icon = field.display(value).icon;
      return getPublicOrAbsoluteUrl(icon ?? '');
    }

    return '';
  };

  return {
    field,
    get: (index: number): string => getIcon(field.values[index]),
    value: () => getIcon(getLastNotNullFieldValue(field)),
  };
}
