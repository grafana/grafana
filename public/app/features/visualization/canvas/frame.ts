import { CanvasElementOptions } from './element';

export interface CanvasFrameOptions extends CanvasElementOptions {
  type: 'frame';
  elements: CanvasElementOptions[];
}
