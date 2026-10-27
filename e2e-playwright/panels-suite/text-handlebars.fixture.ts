import Handlebars from 'handlebars';

import { createTemplateSandbox as createSandbox } from '../../public/app/plugins/panel/text/v2/templateSandbox/client';
import { type HelperResolver } from '../../public/app/plugins/panel/text/v2/templateSandbox/helpers';

export function createTemplateSandbox(nonce?: string, timeout?: number) {
  const session = createSandbox(nonce, timeout);
  const resolveHelper: HelperResolver = (name, args) => {
    if (name === 'date') {
      return new Date(Number(args[0])).toISOString();
    }
    const variables: Record<string, string[]> = { region: ['east', 'west'], selected: ['region'] };
    const value = variables[String(args[0])] ?? [];
    return name === 'variable' ? value : value.join(',');
  };
  return {
    ...session,
    ready: session.ready.then(() => {
      try {
        Handlebars.compile('{{value}}')({ value: 'blocked' });
        return false;
      } catch {
        return true;
      }
    }),
    async render(template: string, data: Record<string, unknown>) {
      const { readRows, ...result } = await session.render({ template, data, trackRows: true }, resolveHelper);
      return result;
    },
    renderTracked: (template: string, data: Record<string, unknown>) =>
      session.render({ template, data, trackRows: true }, resolveHelper),
    renderAbortable: (signal: AbortSignal) =>
      session.render({ template: '{{value}}', data: { value: 'cancelled' }, trackRows: false }, resolveHelper, signal),
  };
}
