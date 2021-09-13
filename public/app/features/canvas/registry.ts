import { Registry } from '@grafana/data';
import { CanvasElementItem, CanvasElementOptions } from './element';
import { iconItem } from './elements/icon';
import { textBoxItem } from './elements/textBox';

export const DEFAULT_CANVAS_ELEMENT_CONFIG: CanvasElementOptions = {
  type: iconItem.id,
  config: { ...iconItem.defaultConfig },
  placement: { ...iconItem.defaultSize },
};

export const canvasElementRegistry = new Registry<CanvasElementItem>(() => [
  iconItem, // default for now
  textBoxItem,
]);
