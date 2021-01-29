import React from 'react';
import { DataFrame, getFieldDisplayName } from '@grafana/data';
import { GraphNGLegendEventMode, StackingOptions } from './types';

export function mapMouseEventToMode(event: React.MouseEvent): GraphNGLegendEventMode {
  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    return GraphNGLegendEventMode.AppendToSelection;
  }
  return GraphNGLegendEventMode.ToggleSelection;
}

export function getNamesToFieldIndex(frame: DataFrame): Map<string, number> {
  const names = new Map<string, number>();
  for (let i = 0; i < frame.fields.length; i++) {
    names.set(getFieldDisplayName(frame.fields[i], frame), i);
  }
  return names;
}

export function preparePlotData(frame: DataFrame, stacking: StackingOptions = { enable: false, isPercent: false }) {
  if (!stacking.enable) {
    return frame.fields.map((f) => f.values.toArray());
  }

  // TODO: percent stacking
  const acc = Array(frame.fields[0].values.length).fill(0);
  const result = [];
  for (let i = 1; i < frame.fields.length; i++) {
    for (let j = 0; j < frame.fields[i].values.length; j++) {
      const v = frame.fields[i].values.get(j);
      acc[j] += v === null || v === undefined ? 0 : +v;
    }
    result.push([...acc]);
  }
  return [frame.fields[0].values.toArray()].concat(result);
}
