import { DataFrame } from '@grafana/data';
import { ResourceDimensionConfig, ResourceDimensionMode } from '@grafana/schema';

import { DimensionSupplier } from './types';
import { findField, getLastNotNullFieldValue } from './utils';

//---------------------------------------------------------
// Resource dimension
//---------------------------------------------------------
export function getPublicOrAbsoluteUrl(path: unknown): string {
  if (!path || typeof path !== 'string') {
    return '';
  }

  // NOTE: The value of `path` could be either an URL string or a relative
  //       path to a Grafana CDN asset served from the CDN.
  const isUrl = path.indexOf(':/') > 0;

  return isUrl ? path : `${window.__grafana_public_path__}build/${path}`;
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
  const getImageOrIcon = (value: unknown): string => {
    if (typeof value !== 'string') {
      return '';
    }

    let url = value;
    if (field && field.display) {
      const displayValue = field.display(value);
      if (displayValue.icon) {
        url = displayValue.icon;
      }
    }

    return getPublicOrAbsoluteUrl(url);
  };

  return {
    field,
    get: (index: number): string => getImageOrIcon(field.values[index]),
    value: () => getImageOrIcon(getLastNotNullFieldValue(field)),
  };
}
