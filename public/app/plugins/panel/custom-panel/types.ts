import { getDefaultDrawingCode } from './templates';

export const CUSTOM_PANEL_ID = 'custom-panel';

export interface Options {
  /** Drawing code. Runs inside the render sandbox and must call panel.onRender(draw). */
  code: string;
}

export const defaultOptions: Options = {
  // A getter so the template string is only built when a default is actually needed.
  get code() {
    return getDefaultDrawingCode();
  },
};
