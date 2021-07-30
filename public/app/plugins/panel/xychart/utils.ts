import { DataFrame } from '@grafana/data';
import { getColorDimension } from '../geomap/dims/color';
import { getScaledDimension } from '../geomap/dims/scale';
import { findField } from '../geomap/dims/utils';
import { Options, ScatterSeries } from './types';
import { config } from '@grafana/runtime';

export function prepareSeries(options: Options, frames: DataFrame[]): ScatterSeries[] {
  if (!frames.length) {
    return [];
  }
  const cfg = options.series ?? {};
  const frame = frames[0];

  const trace: ScatterSeries = {
    x: findField(frame, cfg.x),
    y: findField(frame, cfg.y),

    color: getColorDimension(frame, cfg.color ?? { fixed: '#F00' }, config.theme2),
    size: getScaledDimension(frame, cfg.size ?? { fixed: 5, min: 1, max: 5 }),

    name: 'hello',
    frame,
  };
  return [trace];
}
