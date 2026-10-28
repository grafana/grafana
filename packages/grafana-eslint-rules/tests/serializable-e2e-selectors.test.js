import { RuleTester } from 'eslint';

import serializableE2ESelectors from '../rules/serializable-e2e-selectors.cjs';

RuleTester.setDefaultConfig({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
});

const ruleTester = new RuleTester();

ruleTester.run('eslint serializable-e2e-selectors', serializableE2ESelectors, {
  valid: [
    {
      name: 'zero-arg constant string',
      code: `const s = { Comp: { form: { '9.5.0': () => 'form[name="addPermission"]' } } };`,
    },
    {
      name: 'zero-arg constant template literal',
      code: `const s = { Comp: { bar: { '10.0.0': () => \`Panel loading bar\` } } };`,
    },
    {
      name: 'single param interpolation',
      code: `const s = { Comp: { opt: { '13.2.0': (value) => \`data-testid radio-button-option \${value}\` } } };`,
    },
    {
      name: 'two param interpolation',
      code: `const s = { Comp: { range: { '13.2.0': (from, to) => \`option \${from} to \${to}\` } } };`,
    },
    {
      name: 'ignores its argument (constant)',
      code: `const s = { Comp: { status: { '9.5.0': (_) => 'Panel status' } } };`,
    },
    {
      name: 'present/absent conditional',
      code: `const s = { Comp: { group: { '11.1.0': (title) => (title ? \`Options group \${title}\` : 'Options group') } } };`,
    },
    {
      name: 'computed MIN_GRAFANA_VERSION key',
      code: `const s = { Comp: { menu: { [MIN_GRAFANA_VERSION]: (title) => \`\${title} menu\` } } };`,
    },
    {
      name: 'non-version key is not treated as a selector',
      code: `const s = { helper: (x) => x.toUpperCase() };`,
    },
    {
      name: 'unrelated arrow function is ignored',
      code: `const upper = [1, 2].map((x) => String(x).toUpperCase());`,
    },
    {
      name: 'parameter returned directly (identity)',
      code: `const s = { Comp: { path: { '9.4.0': (path) => path } } };`,
    },
  ],
  invalid: [
    {
      name: 'method call on a parameter',
      code: `const s = { Comp: { x: { '9.4.0': (value) => value.toLowerCase() } } };`,
      errors: [{ messageId: 'notSerializable' }],
    },
    {
      name: 'arithmetic inside the template',
      code: `const s = { Comp: { x: { '9.4.0': (n) => \`item-\${n + 1}\` } } };`,
      errors: [{ messageId: 'notSerializable' }],
    },
    {
      name: 'call expression inside the template',
      code: `const s = { Comp: { x: { '9.4.0': (value) => \`x \${foo(value)}\` } } };`,
      errors: [{ messageId: 'notSerializable' }],
    },
    {
      name: 'member access inside the template (params object style)',
      code: `const s = { Comp: { x: { '9.4.0': (params) => \`x \${params.title}\` } } };`,
      errors: [{ messageId: 'notSerializable' }],
    },
    {
      name: 'conditional branch is not a plain string',
      code: `const s = { Comp: { x: { '11.1.0': (title) => (title ? \`x \${title.trim()}\` : 'x') } } };`,
      errors: [{ messageId: 'notSerializable' }],
    },
    {
      name: 'multi-arg conditional (generator only handles single-arg conditionals)',
      code: `const s = { Comp: { x: { '11.1.0': (a, b) => (a ? \`x \${b}\` : 'y') } } };`,
      errors: [{ messageId: 'notSerializable' }],
    },
    {
      name: 'block body with logic',
      code: `const s = { Comp: { x: { '9.4.0': (n) => { const y = n + 1; return \`item-\${y}\`; } } } };`,
      errors: [{ messageId: 'notSerializable' }],
    },
  ],
});
