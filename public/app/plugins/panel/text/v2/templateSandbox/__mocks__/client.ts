import Handlebars from 'handlebars';

import { createTemplateHelpers, type HelperResolver } from '../helpers';
import { type TemplateInput } from '../protocol';

// Only transport is replaced in React tests; CSP and the real runtime run in Playwright.
export function createTemplateSandbox() {
  let disposed = false;
  return {
    get disposed() {
      return disposed;
    },
    dispose() {
      disposed = true;
    },
    async render(input: TemplateInput, resolveHelper: HelperResolver, signal?: AbortSignal) {
      if (signal?.aborted || disposed) {
        throw new Error('Cancelled');
      }
      const env = Handlebars.create();
      env.registerHelper(createTemplateHelpers(resolveHelper));
      let readRows = false;
      if (input.trackRows) {
        const observe = (value: Record<string, unknown>) => {
          const rows = value.data;
          Object.defineProperty(value, 'data', {
            configurable: true,
            get() {
              readRows = true;
              return rows;
            },
          });
        };
        observe(input.data);
        if (Array.isArray(input.data.frames)) {
          input.data.frames.forEach(observe);
        }
      }
      return { content: env.compile(input.template)(input.data), readRows };
    },
  };
}
