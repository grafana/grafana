import { DataFrame, Field, FieldType, getFieldDisplayName } from '@grafana/data';

import { XYZDimensionConfig } from './models.gen';

export enum DimensionError {
  NoData,
  BadFrameSelection,
  XNotFound,
}

export interface XYZDimensions {
  frame?: DataFrame;
  error?: DimensionError;
}

export function isGraphable(field: Field) {
  return field.type === FieldType.number || field.type === FieldType.time;
}

export function getXYZDimensions(cfg?: XYZDimensionConfig, data?: DataFrame[]): XYZDimensions {
  if (!data || !data.length) {
    const dims: XYZDimensions = {
      error: DimensionError.NoData,
    };

    return dims;
  }
  if (!cfg) {
    cfg = {
      frame: 0,
    };
  }

  let frame = data[cfg.frame ?? 0];
  if (!frame) {
    const dims: XYZDimensions = {
      error: DimensionError.BadFrameSelection,
    };

    return dims;
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

  const x = frame.fields[xIndex];
  const fields: Field[] = [x];
  for (const f of frame.fields) {
    if (f === x || !isGraphable(f)) {
      continue;
    }
    fields.push(f);
  }

  return {
    frame: {
      ...frame,
      fields,
    },
  };
}
