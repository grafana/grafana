import Handlebars from 'handlebars';

import { type InterpolateFunction } from '@grafana/data';

import { createHostHelperResolver, type TemplateContext } from './handlebars';
import { createTemplateHelpers } from './templateSandbox/helpers';
import { type TemplateInput, type TemplateResult } from './templateSandbox/protocol';

export function compileTemplate(content: string, replaceVariables: InterpolateFunction) {
  const env = Handlebars.create();
  env.registerHelper(createTemplateHelpers(createHostHelperResolver(replaceVariables)));
  return env.compile<TemplateContext>(env.parse(content));
}

export function createSyncTemplateRenderer(replaceVariables: InterpolateFunction) {
  return (input: TemplateInput): TemplateResult => {
    let readRows = false;
    if (input.trackRows) {
      // The parent generator retains its lazy row getters in the synchronous parity runner.
      const observe = (value: Record<string, unknown>) => {
        const rows = value.data;
        Object.defineProperty(value, 'data', {
          configurable: true,
          get: () => {
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
    return { content: compileTemplate(input.template, replaceVariables)(input.data), readRows };
  };
}
