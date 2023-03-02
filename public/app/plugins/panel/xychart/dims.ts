import { DataFrame, Field, FieldMatcher, FieldType, getFieldDisplayName } from '@grafana/data';
import { XYFieldMatchers } from '@grafana/ui/src/components/GraphNG/types';

import { XYDimensionConfig } from './types';

// TODO: fix import

export enum DimensionError {
  NoData,
  BadFrameSelection,
  XNotFound,
}

export interface XYDimensions {
  frame: DataFrame; // matches order from configs, excluds non-graphable values
  x: Field;
  fields: XYFieldMatchers;
  error?: DimensionError;
  hasData?: boolean;
  hasTime?: boolean;
}

export function isGraphable(field: Field) {
  return field.type === FieldType.number;
}

export function getXYDimensions(cfg?: XYDimensionConfig, data?: DataFrame[]): XYDimensions {
  if (!data || !data.length) {
    return { error: DimensionError.NoData } as XYDimensions;
  }
  if (!cfg) {
    cfg = {
      frame: 0,
    };
  }

  let frame = data[cfg.frame ?? 0];
  if (!frame) {
    return { error: DimensionError.BadFrameSelection } as XYDimensions;
  }

  let xIndex = -1;
  for (let i = 0; i < frame.fields.length; i++) {
    const f = frame.fields[i];
    if (cfg.x && cfg.x === getFieldDisplayName(f, frame, data)) {
      xIndex = i;
      break;
    }
    if (isGraphable(f) && !cfg.x) {
      xIndex = i;
      break;
    }
  }

  let hasTime = false;
  const x = frame.fields[xIndex];
  const fields: Field[] = [x];
  for (const f of frame.fields) {
    if (f.type === FieldType.time) {
      hasTime = true;
    }
    if (f === x || !isGraphable(f)) {
      continue;
    }
    if (cfg.exclude) {
      const name = getFieldDisplayName(f, frame, data);
      if (cfg.exclude.includes(name)) {
        continue;
      }
    }
    fields.push(f);
  }

  return {
    x,
    fields: {
      x: getSimpleFieldMatcher(x),
      y: getSimpleFieldNotMatcher(x), // Not x
    },
    frame: {
      ...frame,
      fields,
    },
    hasData: frame.fields.length > 0,
    hasTime,
  };
}

function getSimpleFieldMatcher(f: Field): FieldMatcher {
  if (!f) {
    return () => false;
  }
  // the field may change if sorted
  return (field) => f === field || !!(f.state && f.state === field.state);
}

function getSimpleFieldNotMatcher(f: Field): FieldMatcher {
  if (!f) {
    return () => false;
  }
  const m = getSimpleFieldMatcher(f);
  return (field) => !m(field, undefined as any, undefined as any);
}
