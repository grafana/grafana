import { DRAWING_API_VERSION } from './runtime/constants';
import { getDefaultDrawingCode } from './templates';

export const CUSTOM_PANEL_ID = 'custom-panel';

/** The drawing API version new panels get, and that panels saved without one are pinned to. */
export const DEFAULT_API_VERSION = DRAWING_API_VERSION;

export interface Options {
  /** Drawing code. Runs inside the render sandbox and must call panel.onRender(draw). */
  code: string;
  /** Drawing API version the code was written for. The panel builds ctx for this version. */
  apiVersion?: number;
}

export const defaultOptions: Options = {
  // A getter so the template string is only built when a default is actually needed.
  get code() {
    return getDefaultDrawingCode();
  },
  apiVersion: DEFAULT_API_VERSION,
};
