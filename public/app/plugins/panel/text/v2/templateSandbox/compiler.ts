import type Handlebars from 'handlebars';

export function createNonceCompiler(env: typeof Handlebars, nonce: string) {
  const sourceFor = (template: string) => {
    const specification = env.precompile(template);
    if (typeof specification !== 'string') {
      throw new Error('Expected Handlebars JavaScript source');
    }
    return `document.currentScript.registerTemplate(${specification});`;
  };
  // The policy compiles template text itself; callers cannot pass JavaScript or an AST.
  const policy = window.trustedTypes?.createPolicy('grafana-text-template', { createScript: sourceFor });
  let previous: string | undefined;
  let compiled: Handlebars.TemplateDelegate | undefined;
  let compilations = 0;

  return {
    render(template: string, data: Record<string, unknown>) {
      if (typeof template !== 'string') {
        throw new Error('Expected template text');
      }
      if (template !== previous || !compiled) {
        let candidate: Handlebars.TemplateDelegate | undefined;
        const script = Object.assign(document.createElement('script'), {
          nonce,
          textContent: policy ? policy.createScript(template) : sourceFor(template),
          registerTemplate: (specification: Parameters<typeof env.template>[0]) => {
            candidate = env.template(specification);
          },
        });
        try {
          document.head.append(script);
        } finally {
          script.remove();
        }
        if (!candidate) {
          throw new Error('Nonce-authorized template script did not execute');
        }
        compiled = candidate;
        previous = template;
        compilations++;
      }
      return { content: compiled(data), compilations };
    },
  };
}
