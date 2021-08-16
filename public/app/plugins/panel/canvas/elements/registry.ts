import { Registry } from '@grafana/data';
import { CanvasElementItem, CanvasElementOptions } from '../base';
import { iconItem } from './icon';
import { textBoxItem } from './textBox';

export const DEFAULT_ELEMENT_CONFIG: CanvasElementOptions = {
  type: iconItem.id,
  config: { ...iconItem.defaultConfig },
  placement: { ...iconItem.defaultSize },
};

export const canvasElementRegistry = new Registry<CanvasElementItem>(() => [
  iconItem, // default for now
  textBoxItem,
]);
