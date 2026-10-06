import { getDefaultRenderCode } from './templates';

export const RENDER_PANEL_ID = 'render';

export interface Options {
  /** Drawing code. Runs inside the render sandbox and must call panel.onRender(draw). */
  code: string;
}

export const defaultOptions: Options = {
  // A getter so the template string is only built when a default is actually needed.
  get code() {
    return getDefaultRenderCode();
  },
};
