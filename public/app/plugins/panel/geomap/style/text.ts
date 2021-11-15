import { Style, Text } from 'ol/style';
import { config } from '@grafana/runtime';
import { StyleConfigValues, StyleMaker } from './types';
import { getFillColor } from './markers';

export const textMarkerMaker: StyleMaker = (cfg: StyleConfigValues) => {
  const fontFamily = config.theme2.typography.fontFamily;
  const fontSize = cfg.size ?? 12;
  return new Style({
    text: new Text({
      text: cfg.text ?? '?',
      fill: getFillColor(cfg),
      font: `normal ${fontSize}px ${fontFamily}`,
    }),
  });
};
